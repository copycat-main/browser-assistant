let attachedTabId: number | null = null;
let originalTabId: number | null = null;

export async function attach(tabId: number): Promise<void> {
  if (attachedTabId === tabId) return;
  if (attachedTabId !== null) {
    await detach();
  }
  await chrome.debugger.attach({ tabId }, '1.3');
  attachedTabId = tabId;
  originalTabId = tabId;

  await chrome.debugger.sendCommand({ tabId }, 'Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  });

  await chrome.debugger.sendCommand({ tabId }, 'Page.enable', {});
}

export async function switchToTab(tabId: number): Promise<void> {
  if (attachedTabId === tabId) return;
  // Detach from current tab
  if (attachedTabId !== null) {
    try {
      await chrome.debugger.detach({ tabId: attachedTabId });
    } catch {
      // Already detached
    }
  }
  // Attach to new tab
  await chrome.debugger.attach({ tabId }, '1.3');
  attachedTabId = tabId;

  await chrome.debugger.sendCommand({ tabId }, 'Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  });

  await chrome.debugger.sendCommand({ tabId }, 'Page.enable', {});

  // Focus the new tab
  await chrome.tabs.update(tabId, { active: true });
}

export async function detach(): Promise<void> {
  if (attachedTabId === null) return;
  try {
    await chrome.debugger.detach({ tabId: attachedTabId });
  } catch {
    // Already detached
  }
  attachedTabId = null;
  originalTabId = null;
}

export function getAttachedTabId(): number | null {
  return attachedTabId;
}

export function getOriginalTabId(): number | null {
  return originalTabId;
}

export async function dispatchMouseEvent(
  tabId: number,
  type: 'mousePressed' | 'mouseReleased' | 'mouseMoved',
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle' = 'left',
  clickCount: number = 1
): Promise<void> {
  await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
    type,
    x,
    y,
    button,
    clickCount,
    buttons: type === 'mousePressed' ? 1 : 0,
  });
}

export async function dispatchKeyEvent(
  tabId: number,
  type: 'keyDown' | 'keyUp',
  key: string,
  modifiers: number = 0
): Promise<void> {
  const params: Record<string, unknown> = {
    type,
    modifiers,
    key,
  };

  const keyCodeMap: Record<string, { windowsVirtualKeyCode: number; code: string }> = {
    'Return': { windowsVirtualKeyCode: 13, code: 'Enter' },
    'Enter': { windowsVirtualKeyCode: 13, code: 'Enter' },
    'Tab': { windowsVirtualKeyCode: 9, code: 'Tab' },
    'Escape': { windowsVirtualKeyCode: 27, code: 'Escape' },
    'Backspace': { windowsVirtualKeyCode: 8, code: 'Backspace' },
    'Delete': { windowsVirtualKeyCode: 46, code: 'Delete' },
    'ArrowUp': { windowsVirtualKeyCode: 38, code: 'ArrowUp' },
    'ArrowDown': { windowsVirtualKeyCode: 40, code: 'ArrowDown' },
    'ArrowLeft': { windowsVirtualKeyCode: 37, code: 'ArrowLeft' },
    'ArrowRight': { windowsVirtualKeyCode: 39, code: 'ArrowRight' },
    'Home': { windowsVirtualKeyCode: 36, code: 'Home' },
    'End': { windowsVirtualKeyCode: 35, code: 'End' },
    'PageUp': { windowsVirtualKeyCode: 33, code: 'PageUp' },
    'PageDown': { windowsVirtualKeyCode: 34, code: 'PageDown' },
    'space': { windowsVirtualKeyCode: 32, code: 'Space' },
  };

  const mapped = keyCodeMap[key];
  if (mapped) {
    params.windowsVirtualKeyCode = mapped.windowsVirtualKeyCode;
    params.code = mapped.code;
  }

  await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', params);
}

export async function insertText(tabId: number, text: string): Promise<void> {
  await chrome.debugger.sendCommand({ tabId }, 'Input.insertText', { text });
}

export async function dispatchScrollEvent(
  tabId: number,
  x: number,
  y: number,
  deltaX: number,
  deltaY: number
): Promise<void> {
  await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x,
    y,
    deltaX,
    deltaY,
  });
}

// Listen for debugger detach events
chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId === attachedTabId) {
    attachedTabId = null;
  }
});
