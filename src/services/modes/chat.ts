import { ChatMessage, PageContext, SWToPanelMessage } from '../../types/agent';
import { Characteristic } from '../../types/settings';
import { AnthropicMessage } from '../../types/anthropic';
import { streamMessage } from '../anthropicApi';
import { buildChatPrompt } from '../prompts/modePrompts';

export async function handleChat(
  apiKey: string,
  prompt: string,
  pageContext: PageContext,
  broadcast: (msg: SWToPanelMessage) => void,
  signal?: AbortSignal,
  characteristic?: Characteristic,
  history?: ChatMessage[],
  cachedContext?: string,
  model?: string,
): Promise<void> {
  const systemPrompt = buildChatPrompt(pageContext, characteristic, cachedContext);

  // Build multi-turn messages from history
  const messages: AnthropicMessage[] = [];

  if (history && history.length > 1) {
    // Include prior messages (everything except the last user message, which is the current prompt)
    const priorMessages = history.slice(0, -1);
    for (const msg of priorMessages) {
      messages.push({
        role: msg.role,
        content: [{ type: 'text' as const, text: msg.content }],
      });
    }
  }

  // Add current user message
  messages.push({
    role: 'user' as const,
    content: [{ type: 'text' as const, text: prompt }],
  });

  // Broadcast user message
  broadcast({
    type: 'CHAT_MESSAGE',
    message: {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    },
  });

  await streamMessage(
    apiKey,
    model!,
    systemPrompt,
    messages,
    (delta) => {
      broadcast({ type: 'STREAM_DELTA', text: delta });
    },
    (fullText) => {
      broadcast({ type: 'STREAM_DONE', fullText });
      broadcast({
        type: 'CHAT_MESSAGE',
        message: {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: fullText,
          timestamp: Date.now(),
        },
      });
    },
    signal,
  );
}
