/**
 * AI-based intent classifier using the Anthropic API.
 * Uses the same system prompt and message format as the production router.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TaskMode } from '../types.js';

const ROUTER_MODEL = 'claude-haiku-4-5-20251001';

// Exact same prompt used in production (src/services/prompts/routerPrompt.ts)
const ROUTER_PROMPT = `You classify user prompts into one of four modes. Reply with ONLY the mode name, nothing else.

Modes:
- chat: The user is asking a question, wants an explanation, wants to have a conversation, OR wants you to write/draft/compose content for them (text, posts, emails, code, etc.). If they say "write me a tweet" or "draft an email", they want TEXT output — not browser automation.
- research: The user wants you to search the web, look up information across multiple sources, and synthesize findings.
- extract: The user wants data pulled from the current page — prices, text, tables, summaries, contact info, etc.
- automate: The user wants you to physically interact with the browser — fill forms, click buttons, navigate through multi-step workflows, or go to a specific website. This is ONLY for when the user wants you to control the browser, not just produce text.

Key distinction: "Write me an X post" = chat (produce text). "Post this on X" or "Go to X and post" = automate (control the browser).

Reply with one word: chat, research, extract, or automate.`;

const VALID_MODES: TaskMode[] = ['chat', 'research', 'extract', 'automate'];

interface PageContext {
  url: string;
  title: string;
}

const DEFAULT_PAGE_CONTEXT: PageContext = {
  url: 'https://example.com/page',
  title: 'Example Page',
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export async function classifyAI(
  input: string,
  pageContext: PageContext = DEFAULT_PAGE_CONTEXT,
): Promise<TaskMode> {
  const anthropic = getClient();
  const userMessage = `Page: ${pageContext.title} (${pageContext.url})\nUser prompt: "${input}"`;

  const response = await anthropic.messages.create({
    model: ROUTER_MODEL,
    max_tokens: 10,
    temperature: 0,
    system: ROUTER_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text =
    response.content[0].type === 'text'
      ? response.content[0].text.trim().toLowerCase()
      : 'chat';

  if (text === 'navigate') return 'automate';
  return VALID_MODES.includes(text as TaskMode) ? (text as TaskMode) : 'chat';
}
