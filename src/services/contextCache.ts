import { ChatMessage } from '../types/agent';

const CACHE_PREFIX = 'ctx:';
const MAX_TOTAL_SIZE = 500 * 1024; // 500KB total budget
const MAX_MESSAGES_PER_PAGE = 20;

export interface PageCacheEntry {
  url: string;
  title: string;
  messages: ChatMessage[];
  lastAccessed: number;
  size: number;
}

function cacheKey(url: string): string {
  // Normalize URL: strip hash, keep query params (they often identify pages)
  try {
    const u = new URL(url);
    u.hash = '';
    return CACHE_PREFIX + u.toString();
  } catch {
    return CACHE_PREFIX + url;
  }
}

export async function loadPageContext(url: string): Promise<PageCacheEntry | null> {
  const key = cacheKey(url);
  const result = await chrome.storage.local.get(key);
  const entry = result[key] as PageCacheEntry | undefined;
  if (!entry) return null;

  // Update last accessed time
  entry.lastAccessed = Date.now();
  await chrome.storage.local.set({ [key]: entry });
  return entry;
}

export async function savePageContext(
  url: string,
  title: string,
  messages: ChatMessage[]
): Promise<void> {
  const key = cacheKey(url);

  // Keep only the last N messages
  const trimmed = messages.slice(-MAX_MESSAGES_PER_PAGE);
  const serialized = JSON.stringify(trimmed);

  const entry: PageCacheEntry = {
    url,
    title,
    messages: trimmed,
    lastAccessed: Date.now(),
    size: serialized.length,
  };

  await chrome.storage.local.set({ [key]: entry });

  // Evict if over budget
  await evictIfNeeded();
}

export async function clearPageContext(url: string): Promise<void> {
  const key = cacheKey(url);
  await chrome.storage.local.remove(key);
}

export async function clearAllPageContexts(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keysToRemove = Object.keys(all).filter(k => k.startsWith(CACHE_PREFIX));
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}

async function evictIfNeeded(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const entries: { key: string; entry: PageCacheEntry }[] = [];

  let totalSize = 0;
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(CACHE_PREFIX)) {
      const entry = value as PageCacheEntry;
      entries.push({ key, entry });
      totalSize += entry.size || 0;
    }
  }

  if (totalSize <= MAX_TOTAL_SIZE) return;

  // Sort by lastAccessed ascending (oldest first)
  entries.sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed);

  const keysToRemove: string[] = [];
  while (totalSize > MAX_TOTAL_SIZE && entries.length > 0) {
    const oldest = entries.shift()!;
    keysToRemove.push(oldest.key);
    totalSize -= oldest.entry.size || 0;
  }

  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}

export function buildContextSummary(cached: PageCacheEntry): string {
  if (cached.messages.length === 0) return '';

  const lines: string[] = [];
  for (const msg of cached.messages.slice(-10)) {
    const prefix = msg.role === 'user' ? 'User' : 'Assistant';
    // Truncate long messages in the summary
    const content = msg.content.length > 300
      ? msg.content.substring(0, 300) + '...'
      : msg.content;
    lines.push(`${prefix}: ${content}`);
  }

  return `\n\nPrevious conversation on this page:\n${lines.join('\n')}`;
}
