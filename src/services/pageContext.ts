import { PageContext } from '../types/agent';

export async function getPageContext(tabId: number): Promise<PageContext> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const link = document.querySelector<HTMLLinkElement>(
          'link[rel="icon"], link[rel="shortcut icon"], link[rel*="icon"]',
        );
        const favicon = link?.href || window.location.origin + '/favicon.ico';
        return {
          url: window.location.href,
          title: document.title,
          favicon,
          selectedText: (window.getSelection()?.toString() || '').substring(0, 5000),
          domain: window.location.hostname,
        };
      },
    });
    return results[0]?.result || fallbackContext(tabId);
  } catch {
    return fallbackContext(tabId);
  }
}

async function fallbackContext(tabId: number): Promise<PageContext> {
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url || '';
    let domain = '';
    try {
      domain = new URL(url).hostname;
    } catch {}
    return {
      url,
      title: tab.title || '',
      favicon: tab.favIconUrl || '',
      selectedText: '',
      domain,
    };
  } catch {
    return { url: '', title: '', favicon: '', selectedText: '', domain: '' };
  }
}

export async function getPageText(
  tabId: number,
): Promise<{ text: string; url: string; title: string }> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        const removeSelectors = [
          'nav',
          'footer',
          'header',
          'aside',
          '[role="navigation"]',
          '[role="banner"]',
          '.ad',
          '.ads',
          'script',
          'style',
          'noscript',
        ];
        for (const sel of removeSelectors) {
          clone.querySelectorAll(sel).forEach((el) => el.remove());
        }
        const text = clone.innerText || clone.textContent || '';
        return {
          text: text
            .replace(/\n{3,}/g, '\n\n')
            .trim()
            .substring(0, 50000),
          url: window.location.href,
          title: document.title,
        };
      },
    });
    return results[0]?.result || { text: '', url: '', title: '' };
  } catch {
    return { text: '', url: '', title: '' };
  }
}
