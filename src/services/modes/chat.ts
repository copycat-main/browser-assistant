import { PageContext, SWToPanelMessage } from '../../types/agent';
import { streamMessage } from '../anthropicApi';
import { buildChatPrompt } from '../prompts/modePrompts';

export async function handleChat(
  apiKey: string,
  model: string,
  prompt: string,
  pageContext: PageContext,
  broadcast: (msg: SWToPanelMessage) => void,
  signal?: AbortSignal
): Promise<void> {
  const systemPrompt = buildChatPrompt(pageContext);

  const messages = [
    {
      role: 'user' as const,
      content: [{ type: 'text' as const, text: prompt }],
    },
  ];

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
    model,
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
    signal
  );
}
