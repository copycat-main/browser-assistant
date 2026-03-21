function getFavicon(): string {
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel*="icon"]',
  );
  if (link?.href) return link.href;
  return window.location.origin + '/favicon.ico';
}

function getPageText(): string {
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
    '.advertisement',
    'script',
    'style',
    'noscript',
  ];
  for (const sel of removeSelectors) {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  }
  const text = clone.innerText || clone.textContent || '';
  return text
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, 50000);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_PAGE_INFO') {
    sendResponse({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      title: document.title,
      url: window.location.href,
    });
    return true;
  }

  if (message.type === 'GET_PAGE_CONTEXT') {
    sendResponse({
      url: window.location.href,
      title: document.title,
      favicon: getFavicon(),
      selectedText: (window.getSelection()?.toString() || '').substring(0, 5000),
      domain: window.location.hostname,
    });
    return true;
  }

  if (message.type === 'GET_PAGE_TEXT') {
    sendResponse({
      text: getPageText(),
      url: window.location.href,
      title: document.title,
    });
    return true;
  }
});
