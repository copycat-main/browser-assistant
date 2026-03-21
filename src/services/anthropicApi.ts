import {
  AnthropicMessage,
  AnthropicContent,
  AnthropicResponse,
  AnthropicError,
  COMPUTER_USE_TOOL,
  BETA_HEADER,
  StreamEvent,
} from '../types/anthropic';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 8096;
// Anthropic allows max 4 cache_control blocks total.
// System prompt uses 1, so we reserve 3 for images in messages.
const MAX_CACHE_BLOCKS = 3;

export async function sendMessage(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: AnthropicMessage[],
  signal?: AbortSignal,
  useTools: boolean = true,
): Promise<AnthropicResponse> {
  const preparedMessages = applyCacheControl(messages);

  const body: Record<string, unknown> = {
    model,
    max_tokens: MAX_TOKENS,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: preparedMessages,
  };

  if (useTools) {
    body.tools = [COMPUTER_USE_TOOL];
  }

  const response = await fetchWithRetry(apiKey, body, signal);
  return response;
}

export async function streamMessage(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: AnthropicMessage[],
  onDelta: (text: string) => void,
  onComplete: (fullText: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const error: AnthropicError = await response.json();
      errorMessage = error.error?.message || errorMessage;
    } catch {
      // Response body wasn't JSON
    }
    throw new Error(`Anthropic API error: ${errorMessage}`);
  }

  if (!response.body) {
    throw new Error('No response body received from streaming API');
  }

  // Read the stream as fast as possible — fire deltas inline, no await overhead
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process all complete lines in one pass
    let start = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] !== '\n') continue;
      const line = buffer.substring(start, i);
      start = i + 1;

      // Fast prefix check — skip non-data lines without substring allocation
      if (line.length < 7 || line.charCodeAt(0) !== 100 /* 'd' */) continue;
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.substring(6);
      if (jsonStr.length === 0) continue;

      try {
        const event: StreamEvent = JSON.parse(jsonStr);
        if (event.type === 'content_block_delta' && 'text' in event.delta) {
          accumulated += event.delta.text;
          onDelta(event.delta.text);
        } else if (event.type === 'message_stop') {
          onComplete(accumulated);
          return;
        }
      } catch {
        // Skip malformed events
      }
    }
    // Keep only the incomplete trailing line
    buffer = start < buffer.length ? buffer.substring(start) : '';
  }

  // If we exit the loop without message_stop
  onComplete(accumulated);
}

function applyCacheControl(messages: AnthropicMessage[]): AnthropicMessage[] {
  const cloned: AnthropicMessage[] = JSON.parse(JSON.stringify(messages));

  const imageRefs: { msgIdx: number; contentIdx: number; nestedIdx?: number }[] = [];

  for (let m = 0; m < cloned.length; m++) {
    const msg = cloned[m];
    for (let c = 0; c < msg.content.length; c++) {
      const block = msg.content[c];
      if (block.type === 'image') {
        delete (block as unknown as Record<string, unknown>).cache_control;
        imageRefs.push({ msgIdx: m, contentIdx: c });
      } else if (
        block.type === 'tool_result' &&
        Array.isArray((block as { content?: AnthropicContent[] }).content)
      ) {
        const nested = (block as { content: AnthropicContent[] }).content;
        for (let n = 0; n < nested.length; n++) {
          if (nested[n].type === 'image') {
            delete (nested[n] as unknown as Record<string, unknown>).cache_control;
            imageRefs.push({ msgIdx: m, contentIdx: c, nestedIdx: n });
          }
        }
      }
    }
  }

  const toCache = imageRefs.slice(-MAX_CACHE_BLOCKS);
  for (const ref of toCache) {
    if (ref.nestedIdx !== undefined) {
      const toolResult = cloned[ref.msgIdx].content[ref.contentIdx] as {
        content: AnthropicContent[];
      };
      (toolResult.content[ref.nestedIdx] as unknown as Record<string, unknown>).cache_control = {
        type: 'ephemeral',
      };
    } else {
      (
        cloned[ref.msgIdx].content[ref.contentIdx] as unknown as Record<string, unknown>
      ).cache_control = { type: 'ephemeral' };
    }
  }

  return cloned;
}

async function fetchWithRetry(
  apiKey: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
  retries: number = 5,
): Promise<AnthropicResponse> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'anthropic-beta': BETA_HEADER,
      },
      body: JSON.stringify(body),
      signal,
    });

    if ((response.status === 429 || response.status === 529) && attempt < retries - 1) {
      const retryAfter = response.headers.get('retry-after');
      const baseWait = response.status === 529 ? 5000 : 2000;
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : baseWait * Math.pow(2, attempt);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, waitMs);
        if (signal) {
          const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          };
          if (signal.aborted) {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          signal.addEventListener('abort', onAbort, { once: true });
        }
      });
      continue;
    }

    if (!response.ok) {
      const error: AnthropicError = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    return await response.json();
  }

  throw new Error('Max retries exceeded');
}
