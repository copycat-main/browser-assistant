import {
  AnthropicMessage,
  AnthropicContent,
  AnthropicResponse,
  AnthropicError,
  COMPUTER_USE_TOOL,
  BETA_HEADER,
} from '../types/anthropic';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 8096;
const MAX_CACHE_BLOCKS = 4;

export async function sendMessage(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: AnthropicMessage[],
  signal?: AbortSignal
): Promise<AnthropicResponse> {
  // Apply cache_control to only the last N image blocks (Anthropic limits to 4)
  const preparedMessages = applyCacheControl(messages);

  const response = await fetchWithRetry(
    apiKey,
    {
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: [COMPUTER_USE_TOOL],
      messages: preparedMessages,
    },
    signal
  );

  return response;
}

function applyCacheControl(messages: AnthropicMessage[]): AnthropicMessage[] {
  // Deep clone to avoid mutating the originals
  const cloned: AnthropicMessage[] = JSON.parse(JSON.stringify(messages));

  // Collect all image blocks across all messages (in order)
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

  // Apply cache_control to only the last MAX_CACHE_BLOCKS images
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

    // Retry on rate limit (429) or overloaded (529)
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

export function buildSystemPrompt(
  userProfile?: Record<string, string>,
  templates?: Record<string, Record<string, string>>
): string {
  let prompt = `You are a fast browser automation assistant. You see the user's screen and control it.

You MUST return multiple tool calls in a single response whenever the page will not change. This is critical for performance.

<when-to-batch>
FORMS: When you see a form, fill ALL visible fields in one response.
  → left_click(field1) + type("value1") + key("Tab") + type("value2") + key("Tab") + type("value3")
  That is one response with 6 tool calls. Never send them as separate responses.

TYPING: Always pair click + type together.
  → left_click(input) + type("hello")

SEQUENTIAL FIELDS: Use Tab to move between fields without clicking each one.
  → left_click(first field) + type("val") + key("Tab") + type("val") + key("Tab") + type("val")
</when-to-batch>

<when-to-use-single-action>
Only use one tool call when the page might change:
- Clicking a link, navigation button, or submit button
- You are unsure what happens next
Then wait for the new screenshot.
</when-to-use-single-action>

<tips>
- Click the center of elements precisely.
- key("Return") for Enter, key("Tab") for Tab.
- Use wait if loading, scroll if content is off-screen.
- Keep text reasoning to one short sentence.
</tips>
`;

  if (userProfile) {
    const filledFields = Object.entries(userProfile)
      .filter(([_, v]) => v && v.trim())
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');

    if (filledFields) {
      prompt += `\n\nUser profile information (use this when filling out forms):\n${filledFields}`;
    }
  }

  if (templates) {
    for (const [templateName, fields] of Object.entries(templates)) {
      const lines: string[] = [];

      const filledFields = Object.entries(fields)
        .filter(([_, v]) => v && v.trim())
        .map(([k, v]) => `  ${k}: ${v}`);
      lines.push(...filledFields);

      if (lines.length > 0) {
        prompt += `\n\n"${templateName}" template (use when the user asks to fill with ${templateName.toLowerCase()} info):\n${lines.join('\n')}`;
      }
    }
  }

  return prompt;
}
