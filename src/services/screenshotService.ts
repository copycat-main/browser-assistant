const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 768;

export interface ScreenshotResult {
  base64: string;
  scaleX: number;
  scaleY: number;
  cssWidth: number;
  cssHeight: number;
}

export async function captureAndScaleScreenshot(tabId: number): Promise<ScreenshotResult> {
  // Focus the tab first — captureVisibleTab requires it
  await chrome.tabs.update(tabId, { active: true });
  await new Promise((r) => setTimeout(r, 150));

  // Get actual CSS viewport dimensions and DPR via the debugger (already attached)
  const { cssWidth, cssHeight } = await getViewportDimensions(tabId);

  const tab = await chrome.tabs.get(tabId);
  const windowId = tab.windowId;

  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: 'png',
    quality: 100,
  });

  // Decode the PNG
  const base64Data = dataUrl.split(',')[1];
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Scale to target size using OffscreenCanvas (service worker compatible)
  const imageBitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  const canvas = new OffscreenCanvas(TARGET_WIDTH, TARGET_HEIGHT);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageBitmap, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
  imageBitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const arrayBuffer = await blob.arrayBuffer();
  const scaledBytes = new Uint8Array(arrayBuffer);
  const scaledBase64 = uint8ToBase64(scaledBytes);

  return {
    base64: scaledBase64,
    scaleX: cssWidth / TARGET_WIDTH,
    scaleY: cssHeight / TARGET_HEIGHT,
    cssWidth,
    cssHeight,
  };
}

async function getViewportDimensions(
  tabId: number,
): Promise<{ cssWidth: number; cssHeight: number }> {
  try {
    const result = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression:
        'JSON.stringify({ innerWidth: window.innerWidth, innerHeight: window.innerHeight })',
      returnByValue: true,
    });
    const parsed = JSON.parse((result as { result: { value: string } }).result.value);
    return { cssWidth: parsed.innerWidth, cssHeight: parsed.innerHeight };
  } catch {
    // Fallback: use tab dimensions from the content script
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_INFO' });
      return { cssWidth: response.viewportWidth, cssHeight: response.viewportHeight };
    } catch {
      // Last resort fallback — assume standard 1440x900 Retina
      return { cssWidth: 1440, cssHeight: 900 };
    }
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
