import { ComputerAction } from '../types/anthropic';
import * as debugger_ from './debuggerService';

interface ScaleFactors {
  scaleX: number;
  scaleY: number;
}

export async function executeAction(
  tabId: number,
  action: ComputerAction,
  scale: ScaleFactors
): Promise<string> {
  switch (action.action) {
    case 'screenshot':
      return 'Screenshot taken';

    case 'left_click':
      return await click(tabId, action.coordinate, 'left', 1, scale);

    case 'right_click':
      return await click(tabId, action.coordinate, 'right', 1, scale);

    case 'double_click':
      return await click(tabId, action.coordinate, 'left', 2, scale);

    case 'middle_click':
      return await click(tabId, action.coordinate, 'middle', 1, scale);

    case 'triple_click':
      return await click(tabId, action.coordinate, 'left', 3, scale);

    case 'type':
      await debugger_.insertText(tabId, action.text);
      return `Typed: "${action.text.substring(0, 50)}${action.text.length > 50 ? '...' : ''}"`;

    case 'key':
      return await pressKey(tabId, action.text);

    case 'scroll':
      return await scroll(tabId, action.coordinate, action.delta_x, action.delta_y, scale);

    case 'wait':
      await new Promise(r => setTimeout(r, 2000));
      return 'Waited 2 seconds';

    case 'mouse_move': {
      const [mx, my] = scaleCoord(action.coordinate, scale);
      await debugger_.dispatchMouseEvent(tabId, 'mouseMoved', mx, my);
      return `Moved mouse to (${action.coordinate[0]}, ${action.coordinate[1]})`;
    }

    case 'left_click_drag': {
      const [sx, sy] = scaleCoord(action.start_coordinate, scale);
      const [ex, ey] = scaleCoord(action.coordinate, scale);
      await debugger_.dispatchMouseEvent(tabId, 'mousePressed', sx, sy, 'left');
      await new Promise(r => setTimeout(r, 100));
      await debugger_.dispatchMouseEvent(tabId, 'mouseMoved', ex, ey, 'left');
      await new Promise(r => setTimeout(r, 100));
      await debugger_.dispatchMouseEvent(tabId, 'mouseReleased', ex, ey, 'left');
      return `Dragged from (${action.start_coordinate[0]}, ${action.start_coordinate[1]}) to (${action.coordinate[0]}, ${action.coordinate[1]})`;
    }

    default:
      return `Unknown action: ${(action as ComputerAction).action}`;
  }
}

function scaleCoord(coord: [number, number], scale: ScaleFactors): [number, number] {
  return [
    Math.round(coord[0] * scale.scaleX),
    Math.round(coord[1] * scale.scaleY),
  ];
}

async function click(
  tabId: number,
  coordinate: [number, number],
  button: 'left' | 'right' | 'middle',
  clickCount: number,
  scale: ScaleFactors
): Promise<string> {
  const [x, y] = scaleCoord(coordinate, scale);

  // Move to position first
  await debugger_.dispatchMouseEvent(tabId, 'mouseMoved', x, y, button);
  await new Promise(r => setTimeout(r, 50));

  for (let i = 1; i <= clickCount; i++) {
    await debugger_.dispatchMouseEvent(tabId, 'mousePressed', x, y, button, i);
    await debugger_.dispatchMouseEvent(tabId, 'mouseReleased', x, y, button, i);
    if (i < clickCount) await new Promise(r => setTimeout(r, 50));
  }

  const clickType = clickCount === 2 ? 'Double-clicked' : clickCount === 3 ? 'Triple-clicked' : `${button}-clicked`;
  return `${clickType} at (${coordinate[0]}, ${coordinate[1]})`;
}

async function pressKey(tabId: number, keyCombo: string): Promise<string> {
  // Parse key combinations like "ctrl+a", "Return", "shift+Tab"
  const parts = keyCombo.split('+').map(p => p.trim());
  let modifiers = 0;
  const keys: string[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') {
      modifiers |= 2;
    } else if (lower === 'alt') {
      modifiers |= 1;
    } else if (lower === 'shift') {
      modifiers |= 8;
    } else if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'super') {
      modifiers |= 4;
    } else {
      keys.push(part);
    }
  }

  for (const key of keys) {
    await debugger_.dispatchKeyEvent(tabId, 'keyDown', key, modifiers);
    await debugger_.dispatchKeyEvent(tabId, 'keyUp', key, modifiers);
  }

  return `Pressed: ${keyCombo}`;
}

async function scroll(
  tabId: number,
  coordinate: [number, number],
  deltaX: number,
  deltaY: number,
  scale: ScaleFactors
): Promise<string> {
  const [x, y] = scaleCoord(coordinate, scale);
  // Anthropic sends scroll amounts in "clicks" — multiply for pixel delta
  const pixelDeltaX = deltaX * 100;
  const pixelDeltaY = deltaY * 100;
  await debugger_.dispatchScrollEvent(tabId, x, y, pixelDeltaX, pixelDeltaY);
  return `Scrolled (${deltaX}, ${deltaY}) at (${coordinate[0]}, ${coordinate[1]})`;
}
