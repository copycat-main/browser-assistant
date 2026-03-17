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
const MAX_CACHE_BLOCKS = 4;

export async function sendMessage(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: AnthropicMessage[],
  signal?: AbortSignal,
  useTools: boolean = true
): Promise<AnthropicResponse> {
  const preparedMessages = applyCacheControl(messages);

  const body: Record<string, unknown> = {
    model,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
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
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const error: AnthropicError = await response.json();
    throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event: StreamEvent = JSON.parse(jsonStr);

          if (event.type === 'content_block_delta') {
            if ('text' in event.delta) {
              accumulated += event.delta.text;
              onDelta(event.delta.text);
            }
          } else if (event.type === 'message_stop') {
            onComplete(accumulated);
            return;
          }
        } catch {
          // Skip malformed events
        }
      }
    }
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
      } else if (block.type === 'tool_result' && Array.isArray((block as { content?: AnthropicContent[] }).content)) {
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
      const toolResult = cloned[ref.msgIdx].content[ref.contentIdx] as { content: AnthropicContent[] };
      (toolResult.content[ref.nestedIdx] as unknown as Record<string, unknown>).cache_control = { type: 'ephemeral' };
    } else {
      (cloned[ref.msgIdx].content[ref.contentIdx] as unknown as Record<string, unknown>).cache_control = { type: 'ephemeral' };
    }
  }

  return cloned;
}

async function fetchWithRetry(
  apiKey: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
  retries: number = 5
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
      await new Promise(r => setTimeout(r, waitMs));
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
