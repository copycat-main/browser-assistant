import { TaskMode, PageContext } from '../types/agent';
import { DEFAULT_MODEL } from '../types/settings';
import { ROUTER_PROMPT } from './prompts/routerPrompt';

const CHAT_PATTERNS = [
  /^(what|who|why|how|when|where|which|is|are|was|were|do|does|did|can|could|would|should|tell me|explain|describe)\s/i,
  /\?$/,
  /^(write|draft|compose|create|generate|make)\s+(me\s+)?(a\s+|an\s+)?(tweet|post|email|message|letter|essay|paragraph|summary|text|response|reply|bio|caption|headline|title|tagline|slogan|script|outline|article|blog|report|review|description|pitch|proposal|story|poem|song|joke)/i,
];

const EXTRACT_PATTERNS = [
  /^(extract|get|pull|grab|scrape|list|show me|give me)\s+(the |all |every |each )?(data|info|prices?|emails?|names?|links?|text|content|numbers?|details?|items?|products?)/i,
  /^(summarize|sum up|tldr|overview of)\s+(this|the)\s+(page|article|post|site)/i,
];

const RESEARCH_PATTERNS = [
  /^(research|look up|find out|investigate|compare|what are the best|find me|look into)\s/i,
  /^(search|search for|look for)\s+(?!.+\s+on\s+\w+)/i,
];

export function classifyIntentFast(prompt: string): TaskMode | null {
  const trimmed = prompt.trim();

  for (const pattern of EXTRACT_PATTERNS) {
    if (pattern.test(trimmed)) return 'extract';
  }
  for (const pattern of RESEARCH_PATTERNS) {
    if (pattern.test(trimmed)) return 'research';
  }
  for (const pattern of CHAT_PATTERNS) {
    if (pattern.test(trimmed)) return 'chat';
  }

  return null;
}

export async function classifyIntentWithAI(
  apiKey: string,
  prompt: string,
  pageContext: PageContext,
  signal?: AbortSignal,
): Promise<TaskMode> {
  const userMessage = `Page: ${pageContext.title} (${pageContext.url})\nUser prompt: "${prompt}"`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 10,
      system: ROUTER_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal,
  });

  if (!response.ok) {
    return 'chat';
  }

  const data = await response.json();
  const text = data.content?.[0]?.text?.trim().toLowerCase() || 'chat';

  const validModes: TaskMode[] = ['chat', 'research', 'extract', 'automate'];
  if (text === 'navigate') return 'automate';
  return validModes.includes(text as TaskMode) ? (text as TaskMode) : 'chat';
}

export async function classifyIntent(
  apiKey: string,
  prompt: string,
  pageContext: PageContext,
  signal?: AbortSignal,
): Promise<TaskMode> {
  const fastResult = classifyIntentFast(prompt);
  if (fastResult) return fastResult;

  return classifyIntentWithAI(apiKey, prompt, pageContext, signal);
}
