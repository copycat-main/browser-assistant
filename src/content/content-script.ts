let glowOverlay: HTMLDivElement | null = null;

function showGlow() {
  if (glowOverlay) return;
  glowOverlay = document.createElement('div');
  glowOverlay.id = 'copycat-glow-overlay';
  glowOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
    border: 2px solid rgba(212, 165, 116, 0.6);
    border-radius: 0;
    box-shadow: inset 0 0 30px rgba(212, 165, 116, 0.15), 0 0 15px rgba(212, 165, 116, 0.2);
    transition: opacity 0.3s ease;
  `;
  document.documentElement.appendChild(glowOverlay);
}

function hideGlow() {
  if (!glowOverlay) return;
  glowOverlay.style.opacity = '0';
  setTimeout(() => {
    glowOverlay?.remove();
    glowOverlay = null;
  }, 300);
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
