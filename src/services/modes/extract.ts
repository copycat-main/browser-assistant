import { ChatMessage, PageContext, SWToPanelMessage } from '../../types/agent';
import { Characteristic, DEFAULT_MODEL } from '../../types/settings';
import { AnthropicMessage } from '../../types/anthropic';
import { streamMessage } from '../anthropicApi';
import { buildExtractPrompt } from '../prompts/modePrompts';
import { getPageText } from '../pageContext';

export async function handleExtract(
  apiKey: string,
  prompt: string,
  pageContext: PageContext,
  tabId: number,
  broadcast: (msg: SWToPanelMessage) => void,
  signal?: AbortSignal,
  characteristic?: Characteristic,
  history?: ChatMessage[],
  model: string = DEFAULT_MODEL,
): Promise<void> {
  const systemPrompt = buildExtractPrompt(pageContext, characteristic);

  // Get page text content — always fresh, pages change constantly
  const pageData = await getPageText(tabId);
  const userContent = `${prompt}\n\n--- Page Content ---\n${pageData.text.substring(0, 30000)}`;

  // Build multi-turn messages from history
  const messages: AnthropicMessage[] = [];

  if (history && history.length > 1) {
    const priorMessages = history.slice(0, -1);
    for (const msg of priorMessages) {
      messages.push({
        role: msg.role,
        content: [{ type: 'text' as const, text: msg.content }],
      });
    }
  }

  // Add current user message (with page content appended)
  messages.push({
    role: 'user' as const,
    content: [{ type: 'text' as const, text: userContent }],
  });

  // User message is shown instantly by the UI — no need to broadcast it here

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
    signal,
  );
}
