import { PageContext, SWToPanelMessage, ResearchProgress } from '../../types/agent';
import { Characteristic, DEFAULT_MODEL } from '../../types/settings';
import { sendMessage, streamMessage } from '../anthropicApi';
import { RESEARCH_PLAN_PROMPT, buildResearchSynthesisPrompt } from '../prompts/modePrompts';

interface ResearchSource {
  title: string;
  url: string;
  text: string;
}

export async function handleResearch(
  apiKey: string,
  prompt: string,
  pageContext: PageContext,
  broadcast: (msg: SWToPanelMessage) => void,
  signal?: AbortSignal,
  characteristic?: Characteristic,
  sendGlow?: (tabId: number, show: boolean) => void,
): Promise<void> {
  // Get the current active tab — we do all navigation in this single tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');
  const tabId = tab.id;
  const originalUrl = tab.url || pageContext.url;

  broadcast({
    type: 'CHAT_MESSAGE',
    message: {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    },
  });

  const broadcastProgress = (progress: ResearchProgress) => {
    broadcast({ type: 'RESEARCH_PROGRESS', progress });
  };

  // Continuously inject the overlay so it persists through page navigations
  let glowActive = true;
  const glowInterval = setInterval(() => {
    if (glowActive) sendGlow?.(tabId, true);
  }, 100);
  sendGlow?.(tabId, true);

  try {
    // Step 1: Create research plan
    broadcastProgress({ stage: 'planning', detail: 'Creating research plan...' });

    const planMessages = [
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: `Research question: "${prompt}"\nCurrent page: ${pageContext.title} (${pageContext.url})`,
          },
        ],
      },
    ];

    const planResponse = await sendMessage(
      apiKey,
      DEFAULT_MODEL,
      RESEARCH_PLAN_PROMPT,
      planMessages,
      signal,
      false,
    );
    const planText = planResponse.content.find((b) => b.type === 'text');

    let queries: string[] = [];
    let approach = '';
    try {
      const jsonStr = (planText && planText.type === 'text' ? planText.text : '{}')
        .replace(/```json?\n?/g, '')
        .replace(/```/g, '')
        .trim();
      const plan = JSON.parse(jsonStr);
      queries = plan.queries || [];
      approach = plan.approach || '';
    } catch {
      queries = [prompt];
    }

    broadcastProgress({
      stage: 'planning',
      detail: approach || `Searching for ${queries.length} queries...`,
    });

    // Step 2: Search each query in the current tab (single tab, sequential)
    const sources: ResearchSource[] = [];

    for (const query of queries.slice(0, 4)) {
      if (signal?.aborted) break;

      broadcastProgress({ stage: 'searching', detail: `Searching: "${query}"` });

      // Navigate the current tab to Google search
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      await chrome.tabs.update(tabId, { url: searchUrl });
      await waitForTabLoad(tabId, 8000);

      // Extract search results from this page
      const searchResults = await extractSearchResults(tabId);

      // Read top 2 results per query
      for (const result of searchResults.slice(0, 2)) {
        if (signal?.aborted) break;

        broadcastProgress({
          stage: 'reading',
          detail: `Reading: ${result.title}`,
          sources: sources.map((s) => ({ title: s.title, url: s.url })),
        });

        try {
          // Navigate to the result page in the same tab
          await chrome.tabs.update(tabId, { url: result.url });
          await waitForTabLoad(tabId, 8000);

          const pageText = await extractPageText(tabId);
          if (pageText) {
            sources.push({
              title: result.title || pageText.substring(0, 60),
              url: result.url,
              text: pageText.substring(0, 10000),
            });
          }
        } catch {
          // Skip failed pages
        }
      }
    }

    // Step 3: Navigate back to the original page and remove overlay
    glowActive = false;
    clearInterval(glowInterval);
    sendGlow?.(tabId, false);
    try {
      await chrome.tabs.update(tabId, { url: originalUrl });
      await waitForTabLoad(tabId, 5000);
    } catch {
      // Not critical if this fails
    }

    // Step 4: Synthesize findings
    broadcastProgress({
      stage: 'synthesizing',
      detail: `Synthesizing ${sources.length} sources...`,
      sources: sources.map((s) => ({ title: s.title, url: s.url })),
    });

    const synthesisPrompt = buildResearchSynthesisPrompt(pageContext, characteristic);

    let sourcesContext = '';
    for (const source of sources) {
      sourcesContext += `\n\n--- Source: ${source.title} (${source.url}) ---\n${source.text}`;
    }

    const synthesisMessages = [
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: `Research question: "${prompt}"\n\nGathered sources:${sourcesContext}`,
          },
        ],
      },
    ];

    await streamMessage(
      apiKey,
      DEFAULT_MODEL,
      synthesisPrompt,
      synthesisMessages,
      (delta) => {
        broadcast({ type: 'STREAM_DELTA', text: delta });
      },
      (fullText) => {
        broadcastProgress({
          stage: 'done',
          detail: 'Research complete',
          sources: sources.map((s) => ({ title: s.title, url: s.url })),
        });
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
  } catch (error) {
    // Stop overlay loop and try to go back to original page on error
    glowActive = false;
    clearInterval(glowInterval);
    sendGlow?.(tabId, false);
    try {
      await chrome.tabs.update(tabId, { url: originalUrl });
    } catch {}
    throw error;
  }
}

async function waitForTabLoad(tabId: number, timeoutMs: number = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === 'complete') return;
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function extractSearchResults(tabId: number): Promise<{ title: string; url: string }[]> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const links: { title: string; url: string }[] = [];
        const anchors = document.querySelectorAll('a[href]');
        for (const a of anchors) {
          const href = (a as HTMLAnchorElement).href;
          const text = a.textContent?.trim() || '';
          if (
            href.startsWith('http') &&
            !href.includes('google.com') &&
            !href.includes('googleapis.com') &&
            !href.includes('gstatic.com') &&
            !href.includes('youtube.com') &&
            !href.includes('youtu.be') &&
            !href.includes('vimeo.com') &&
            !href.includes('dailymotion.com') &&
            !href.includes('tiktok.com') &&
            text.length > 10 &&
            !href.includes('#') &&
            ((a as HTMLElement).closest('[data-sokoban-container]') !== null ||
              (a as HTMLElement).closest('.g') !== null ||
              (a as HTMLElement).closest('[data-hveid]') !== null)
          ) {
            links.push({ title: text.substring(0, 100), url: href });
          }
        }
        const seen = new Set<string>();
        return links
          .filter((l) => {
            if (seen.has(l.url)) return false;
            seen.add(l.url);
            return true;
          })
          .slice(0, 5);
      },
    });
    return results[0]?.result || [];
  } catch {
    return [];
  }
}

async function extractPageText(tabId: number): Promise<string> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        const remove = [
          'nav',
          'footer',
          'header',
          'aside',
          'script',
          'style',
          'noscript',
          '.ad',
          '.ads',
        ];
        for (const sel of remove) {
          clone.querySelectorAll(sel).forEach((el) => el.remove());
        }
        return (clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
      },
    });
    return results[0]?.result || '';
  } catch {
    return '';
  }
}
