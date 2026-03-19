let glowOverlay: HTMLDivElement | null = null;
let glowBanner: HTMLDivElement | null = null;

function showGlow() {
  if (glowOverlay) return;
  glowOverlay = document.createElement('div');
  glowOverlay.id = 'copycat-glow-overlay';
  glowOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
    border: 3px solid rgba(180, 130, 70, 0.7);
    border-radius: 0;
    box-shadow: inset 0 0 50px rgba(180, 130, 70, 0.35), 0 0 20px rgba(180, 130, 70, 0.25);
    transition: opacity 0.3s ease;
  `;
  document.documentElement.appendChild(glowOverlay);

  glowBanner = document.createElement('div');
  glowBanner.id = 'copycat-glow-banner';
  glowBanner.textContent = 'CopyCat is currently controlling this browser';
  glowBanner.style.cssText = `
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    pointer-events: none;
    background: rgba(180, 130, 70, 0.85);
    color: #fff;
    font-family: -apple-system, sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 18px;
    border-radius: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: opacity 0.3s ease;
  `;
  document.documentElement.appendChild(glowBanner);
}

function hideGlow() {
  if (glowOverlay) {
    glowOverlay.style.opacity = '0';
    setTimeout(() => {
      glowOverlay?.remove();
      glowOverlay = null;
    }, 300);
  }
  if (glowBanner) {
    glowBanner.style.opacity = '0';
    setTimeout(() => {
      glowBanner?.remove();
      glowBanner = null;
    }, 300);
  }
}

function getFavicon(): string {
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel*="icon"]',
  );
  if (link?.href) return link.href;
  return window.location.origin + '/favicon.ico';
}

function getPageText(): string {
  // Strip nav, footer, sidebar, ads for cleaner content
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
  // Collapse whitespace and truncate
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

  if (message.type === 'SHOW_GLOW') {
    showGlow();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'HIDE_GLOW') {
    hideGlow();
    sendResponse({ ok: true });
    return true;
  }
});
