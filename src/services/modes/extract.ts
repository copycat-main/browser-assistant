import { PageContext, SWToPanelMessage } from '../../types/agent';
import { streamMessage } from '../anthropicApi';
import { buildExtractPrompt } from '../prompts/modePrompts';
import { getPageText } from '../pageContext';

export async function handleExtract(
  apiKey: string,
  model: string,
  prompt: string,
  pageContext: PageContext,
  tabId: number,
  broadcast: (msg: SWToPanelMessage) => void,
  signal?: AbortSignal
): Promise<void> {
  const systemPrompt = buildExtractPrompt(pageContext);

  // Get page text content
  const pageData = await getPageText(tabId);

  const userContent = `${prompt}\n\n--- Page Content ---\n${pageData.text.substring(0, 30000)}`;

  const messages = [
    {
      role: 'user' as const,
      content: [{ type: 'text' as const, text: userContent }],
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
