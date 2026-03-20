import { AgentStep, SWToPanelMessage } from '../../types/agent';
import {
  AnthropicMessage,
  AnthropicContent,
  AnthropicToolUseBlock,
  ComputerAction,
} from '../../types/anthropic';
import { Settings, COMPUTER_USE_MODEL } from '../../types/settings';
import { sendMessage } from '../anthropicApi';
import { buildAutomatePrompt } from '../prompts/modePrompts';
import { captureAndScaleScreenshot, ScreenshotResult } from '../screenshotService';
import { executeAction } from '../actionExecutor';
import * as debuggerService from '../debuggerService';

function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function coordStr(coord: [number, number]): string {
  return `(${coord[0]}, ${coord[1]})`;
}

function describeAction(action: ComputerAction): string {
  switch (action.action) {
    case 'screenshot':
      return 'Screenshot';
    case 'left_click':
      return `Click ${coordStr(action.coordinate)}`;
    case 'right_click':
      return `Right-click ${coordStr(action.coordinate)}`;
    case 'double_click':
      return `Double-click ${coordStr(action.coordinate)}`;
    case 'middle_click':
      return `Middle-click ${coordStr(action.coordinate)}`;
    case 'triple_click':
      return `Triple-click ${coordStr(action.coordinate)}`;
    case 'type':
      return `Type "${action.text.substring(0, 30)}${action.text.length > 30 ? '...' : ''}"`;
    case 'key':
      return `Press ${action.text}`;
    case 'scroll':
      return `Scroll ${coordStr(action.coordinate)}`;
    case 'wait':
      return 'Wait';
    case 'mouse_move':
      return `Move mouse ${coordStr(action.coordinate)}`;
    case 'left_click_drag':
      return `Drag ${coordStr(action.start_coordinate)} → ${coordStr(action.coordinate)}`;
    default:
      return 'Action';
  }
}

async function waitForPageStability(tabId: number, maxWaitMs: number = 3000): Promise<void> {
  const start = Date.now();
  const checkInterval = 300;
  await new Promise((r) => setTimeout(r, 200));

  while (Date.now() - start < maxWaitMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === 'complete') return;
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, checkInterval));
  }
}

// Detect if a new tab was opened and switch to it
async function detectAndSwitchToNewTab(knownTabIds: Set<number>): Promise<number | null> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  for (const tab of tabs) {
    if (tab.id && !knownTabIds.has(tab.id) && tab.active) {
      // New active tab found — switch the debugger to it
      try {
        await debuggerService.switchToTab(tab.id);
        knownTabIds.add(tab.id);
        return tab.id;
      } catch {
        // Couldn't attach, continue with current tab
      }
    }
  }

  // Also check if the active tab changed (user or automation switched tabs)
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id && activeTab.id !== debuggerService.getAttachedTabId()) {
    try {
      await debuggerService.switchToTab(activeTab.id);
      knownTabIds.add(activeTab.id);
      return activeTab.id;
    } catch {
      // Couldn't attach
    }
  }

  return null;
}

// If the prompt is asking to go somewhere, Google it first
async function preNavigate(prompt: string, tabId: number): Promise<boolean> {
  const navMatch = prompt.match(
    /^(?:go to|navigate to|open|open up|visit|take me to|launch|go look at|check|pull up)\s+(.+)$/i,
  );
  if (!navMatch) return false;

  const target = navMatch[1].trim().replace(/[."']$/g, '');
  const url = `https://www.google.com/search?q=${encodeURIComponent(target)}`;

  await chrome.tabs.update(tabId, { url });

  // Wait for page to load
  const start = Date.now();
  while (Date.now() - start < 5000) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === 'complete') break;
    } catch {
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return true;
}

export async function handleAutomate(
  prompt: string,
  tabId: number,
  settings: Settings,
  broadcast: (msg: SWToPanelMessage) => void,
  sendGlow: (tabId: number, show: boolean) => void,
  signal: AbortSignal,
): Promise<void> {
  // If the prompt is a navigation request, go there first before attaching debugger
  await preNavigate(prompt, tabId);

  await debuggerService.attach(tabId);
  sendGlow(tabId, true);

  // Track known tabs so we can detect new ones
  const knownTabIds = new Set<number>();
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  for (const t of allTabs) {
    if (t.id) knownTabIds.add(t.id);
  }

  try {
    const systemPrompt = buildAutomatePrompt(
      flattenProfile(settings.userProfile),
      settings.templates,
    );

    const initialScreenshot = await captureAndScaleScreenshot(tabId);

    const messages: AnthropicMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: initialScreenshot.base64,
            },
          },
        ],
      },
    ];

    const initialStep: AgentStep = {
      id: generateStepId(),
      timestamp: Date.now(),
      reasoning: 'Starting task...',
      screenshot: `data:image/png;base64,${initialScreenshot.base64}`,
      status: 'thinking',
    };
    broadcast({ type: 'AGENT_STEP', step: initialStep });

    let scale = { scaleX: initialScreenshot.scaleX, scaleY: initialScreenshot.scaleY };
    const MAX_ITERATIONS = 50;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (signal.aborted) break;

      const response = await sendMessage(
        settings.apiKey,
        COMPUTER_USE_MODEL,
        systemPrompt,
        messages,
        signal,
      );

      const assistantContent = response.content;
      messages.push({ role: 'assistant', content: assistantContent });

      const textBlocks = assistantContent.filter((b) => b.type === 'text');
      const toolUseBlocks = assistantContent.filter(
        (b) => b.type === 'tool_use',
      ) as AnthropicToolUseBlock[];

      const reasoning = textBlocks
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('\n')
        .trim();

      if (toolUseBlocks.length === 0) {
        const finalStep: AgentStep = {
          id: generateStepId(),
          timestamp: Date.now(),
          reasoning: reasoning || 'Task complete.',
          status: 'complete',
        };
        broadcast({ type: 'AGENT_STEP', step: finalStep });
        break;
      }

      const toolResults: AnthropicContent[] = [];
      const actionSteps: AgentStep[] = [];

      for (const toolUse of toolUseBlocks) {
        if (signal.aborted) break;

        const action = toolUse.input as ComputerAction;
        const step: AgentStep = {
          id: generateStepId(),
          timestamp: Date.now(),
          reasoning: actionSteps.length === 0 ? reasoning : '',
          action: action.action,
          actionDetail: describeAction(action),
          status: 'acting',
        };
        actionSteps.push(step);
        broadcast({ type: 'AGENT_STEP', step });

        try {
          if (action.action !== 'screenshot') {
            let currentTabId = debuggerService.getAttachedTabId() || tabId;
            await executeAction(currentTabId, action, scale);

            const isLast = toolUse === toolUseBlocks[toolUseBlocks.length - 1];
            if (isLast) {
              await waitForPageStability(currentTabId);

              // Check if a new tab was opened (e.g. target="_blank" link)
              const newTabId = await detectAndSwitchToNewTab(knownTabIds);
              if (newTabId) {
                await waitForPageStability(newTabId);
                sendGlow(newTabId, true);
              }
            } else {
              await new Promise((r) => setTimeout(r, 100));
            }
          }

          broadcast({
            type: 'AGENT_STEP_UPDATE',
            stepId: step.id,
            updates: { status: 'complete' },
          });
          step.status = 'complete';
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          broadcast({
            type: 'AGENT_STEP_UPDATE',
            stepId: step.id,
            updates: { status: 'error', error: errMsg },
          });
          step.status = 'error';
          step.error = errMsg;

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: [{ type: 'text', text: `Error: ${errMsg}` }],
            is_error: true,
          });
          break;
        }
      }

      if (!signal.aborted) {
        // Use whichever tab is currently active/attached
        let currentTabId = debuggerService.getAttachedTabId() || tabId;
        let screenshot: ScreenshotResult;
        try {
          screenshot = await captureAndScaleScreenshot(currentTabId);
          scale = { scaleX: screenshot.scaleX, scaleY: screenshot.scaleY };
        } catch {
          // Fallback to original tab if current one fails
          try {
            screenshot = await captureAndScaleScreenshot(tabId);
            scale = { scaleX: screenshot.scaleX, scaleY: screenshot.scaleY };
          } catch {
            // Last resort — check active tab
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab?.id) {
              try {
                await debuggerService.switchToTab(activeTab.id);
                screenshot = await captureAndScaleScreenshot(activeTab.id);
                scale = { scaleX: screenshot.scaleX, scaleY: screenshot.scaleY };
              } catch {
                throw new Error('Cannot capture screenshot from any tab');
              }
            } else {
              throw new Error('No active tab available for screenshot');
            }
          }
        }

        const screenshotDataUrl = `data:image/png;base64,${screenshot.base64}`;

        const lastStep = actionSteps[actionSteps.length - 1];
        if (lastStep) {
          broadcast({
            type: 'AGENT_STEP_UPDATE',
            stepId: lastStep.id,
            updates: { screenshot: screenshotDataUrl },
          });
          lastStep.screenshot = screenshotDataUrl;
        }

        for (const toolUse of toolUseBlocks) {
          const alreadyErrored = toolResults.some(
            (r) =>
              r.type === 'tool_result' && (r as { tool_use_id: string }).tool_use_id === toolUse.id,
          );
          if (!alreadyErrored) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: screenshot.base64,
                  },
                },
              ],
            });
          }
        }
      }

      messages.push({ role: 'user', content: toolResults });
    }
  } finally {
    // Clean up glow on all tabs we touched
    const attachedId = debuggerService.getAttachedTabId();
    if (attachedId) sendGlow(attachedId, false);
    if (attachedId !== tabId) sendGlow(tabId, false);
    await debuggerService.detach();
  }
}

function flattenProfile(profile: Settings['userProfile']): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(profile)) {
    if (typeof value === 'string') {
      flat[key] = value;
    }
  }
  return flat;
}
