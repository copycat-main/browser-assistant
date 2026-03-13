import { AgentStep, AgentStatus, PanelToSWMessage, SWToPanelMessage } from '../types/agent';
import { AnthropicMessage, AnthropicContent, AnthropicToolUseBlock, ComputerAction } from '../types/anthropic';
import { Settings, DEFAULT_SETTINGS } from '../types/settings';
import { sendMessage, buildSystemPrompt } from '../services/anthropicApi';
import { captureAndScaleScreenshot, ScreenshotResult } from '../services/screenshotService';
import { executeAction } from '../services/actionExecutor';
import * as debuggerService from '../services/debuggerService';

let agentStatus: AgentStatus = 'idle';
let agentSteps: AgentStep[] = [];
let abortController: AbortController | null = null;


// Handle CDP events: page navigations
chrome.debugger.onEvent.addListener(async (source, method) => {
  if (!source.tabId || agentStatus !== 'running') return;

  // Re-inject glow after navigation
  if (method === 'Page.loadEventFired') {
    sendGlow(source.tabId, true);
  }
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id! });
});

// Enable side panel on all tabs
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message: PanelToSWMessage, _sender, sendResponse) => {
  switch (message.type) {
    case 'START_AGENT':
      startAgent(message.prompt);
      sendResponse({ ok: true });
      break;
    case 'STOP_AGENT':
      stopAgent();
      sendResponse({ ok: true });
      break;
    case 'GET_STATE':
      sendResponse({ status: agentStatus, steps: agentSteps });
      break;
  }
  return true;
});

function broadcast(message: SWToPanelMessage) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel might not be open
  });
}

function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

async function startAgent(prompt: string) {
  if (agentStatus === 'running') return;

  agentStatus = 'running';
  agentSteps = [];
  abortController = new AbortController();

  const settings = await loadSettings();

  if (!settings.apiKey) {
    broadcast({ type: 'AGENT_ERROR', error: 'No API key configured. Please add your Anthropic API key in settings.' });
    agentStatus = 'error';
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    broadcast({ type: 'AGENT_ERROR', error: 'No active tab found' });
    agentStatus = 'error';
    return;
  }
  const tabId = tab.id;

  try {
    await debuggerService.attach(tabId);
    sendGlow(tabId, true);

    const systemPrompt = buildSystemPrompt(
      flattenProfile(settings.userProfile),
      settings.templates
    );

    // Take initial screenshot
    const initialScreenshot = await captureAndScaleScreenshot(tabId);

    // Build initial messages
    const messages: AnthropicMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
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

    // Add initial screenshot step
    const initialStep: AgentStep = {
      id: generateStepId(),
      timestamp: Date.now(),
      reasoning: 'Starting task...',
      screenshot: `data:image/png;base64,${initialScreenshot.base64}`,
      status: 'thinking',
    };
    agentSteps.push(initialStep);
    broadcast({ type: 'AGENT_STEP', step: initialStep });

    // Agent loop
    let scale = { scaleX: initialScreenshot.scaleX, scaleY: initialScreenshot.scaleY };
    const MAX_ITERATIONS = 50;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (abortController.signal.aborted) {
        agentStatus = 'idle';
        sendGlow(tabId, false);
        broadcast({ type: 'AGENT_COMPLETE' });
        return;
      }

      // Call Anthropic API
      const response = await sendMessage(
        settings.apiKey,
        settings.model,
        systemPrompt,
        messages,
        abortController.signal
      );

      // Process response content
      const assistantContent = response.content;
      messages.push({ role: 'assistant', content: assistantContent });

      // Extract text reasoning and tool uses
      const textBlocks = assistantContent.filter(b => b.type === 'text');
      const toolUseBlocks = assistantContent.filter(b => b.type === 'tool_use') as AnthropicToolUseBlock[];

      const reasoning = textBlocks.map(b => b.type === 'text' ? b.text : '').join('\n').trim();

      if (toolUseBlocks.length === 0) {
        // No tool use — agent is done (text response or end_turn)
        const finalStep: AgentStep = {
          id: generateStepId(),
          timestamp: Date.now(),
          reasoning: reasoning || 'Task complete.',
          status: 'complete',
        };
        agentSteps.push(finalStep);
        broadcast({ type: 'AGENT_STEP', step: finalStep });
        break;
      }

      // Execute all tool_use blocks, then take ONE screenshot at the end
      const toolResults: AnthropicContent[] = [];
      const actionSteps: AgentStep[] = [];
      let batchError = false;

      // First pass: execute all actions without screenshotting between them
      for (const toolUse of toolUseBlocks) {
        if (abortController.signal.aborted) break;

        const action = toolUse.input as ComputerAction;

        const step: AgentStep = {
          id: generateStepId(),
          timestamp: Date.now(),
          reasoning: actionSteps.length === 0 ? reasoning : '',
          action: action.action,
          actionDetail: describeAction(action),
          status: 'acting',
        };
        agentSteps.push(step);
        actionSteps.push(step);
        broadcast({ type: 'AGENT_STEP', step });

        try {
          if (action.action !== 'screenshot') {
            const currentTabId = debuggerService.getAttachedTabId() || tabId;
            await executeAction(currentTabId, action, scale);

            // Brief pause between actions — only wait for nav on the last action
            const isLast = toolUse === toolUseBlocks[toolUseBlocks.length - 1];
            if (isLast) {
              await waitForPageStability(currentTabId);
            } else {
              await new Promise(r => setTimeout(r, 100));
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
          batchError = true;

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: [{ type: 'text', text: `Error: ${errMsg}` }],
            is_error: true,
          });
          break; // Stop executing further actions on error
        }
      }

      // Second pass: take ONE screenshot and use it for all successful tool results
      if (!abortController.signal.aborted) {
        const currentTabId = debuggerService.getAttachedTabId() || tabId;
        let screenshot: ScreenshotResult;
        try {
          screenshot = await captureAndScaleScreenshot(currentTabId);
          scale = { scaleX: screenshot.scaleX, scaleY: screenshot.scaleY };
        } catch {
          screenshot = await captureAndScaleScreenshot(tabId);
          scale = { scaleX: screenshot.scaleX, scaleY: screenshot.scaleY };
        }

        const screenshotDataUrl = `data:image/png;base64,${screenshot.base64}`;

        // Attach screenshot to the last action step
        const lastStep = actionSteps[actionSteps.length - 1];
        if (lastStep) {
          broadcast({
            type: 'AGENT_STEP_UPDATE',
            stepId: lastStep.id,
            updates: { screenshot: screenshotDataUrl },
          });
          lastStep.screenshot = screenshotDataUrl;
        }

        // Build tool results — all successful ones share the same screenshot
        for (const toolUse of toolUseBlocks) {
          const alreadyErrored = toolResults.some(
            r => r.type === 'tool_result' && (r as { tool_use_id: string }).tool_use_id === toolUse.id
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

      // Append tool results as user message
      messages.push({ role: 'user', content: toolResults });
    }

    agentStatus = 'idle';
    sendGlow(tabId, false);
    await debuggerService.detach();
    broadcast({ type: 'AGENT_COMPLETE' });
  } catch (error) {
    if (abortController.signal.aborted) {
      agentStatus = 'idle';
      broadcast({ type: 'AGENT_COMPLETE' });
    } else {
      const errMsg = error instanceof Error ? error.message : String(error);
      agentStatus = 'error';
      broadcast({ type: 'AGENT_ERROR', error: errMsg });
    }
    sendGlow(tabId, false);
    await debuggerService.detach();
  }
}

function stopAgent() {
  if (abortController) {
    abortController.abort();
    agentStatus = 'stopping';
  }
}


function sendGlow(tabId: number, show: boolean) {
  const script = show
    ? `(function() {
        if (document.getElementById('copycat-glow')) return;
        const style = document.createElement('style');
        style.id = 'copycat-glow-style';
        style.textContent = \`
          @keyframes copycatPulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
        \`;
        document.head.appendChild(style);

        const el = document.createElement('div');
        el.id = 'copycat-glow';
        el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;' +
          'box-shadow:inset 0 0 40px 15px rgba(212,165,116,0.45), inset 0 0 80px 30px rgba(212,165,116,0.2);' +
          'animation:copycatPulse 3s ease-in-out infinite;';
        document.documentElement.appendChild(el);
      })()`
    : `(function() {
        const el = document.getElementById('copycat-glow');
        if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s ease'; setTimeout(() => el.remove(), 300); }
        const style = document.getElementById('copycat-glow-style');
        if (style) setTimeout(() => style.remove(), 300);
      })()`;

  chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
    expression: script,
    returnByValue: true,
  }).catch(() => {});
}

async function waitForPageStability(tabId: number, maxWaitMs: number = 3000): Promise<void> {
  const start = Date.now();
  const checkInterval = 300;

  // Wait a minimum of 200ms for any navigation/rendering to start
  await new Promise(r => setTimeout(r, 200));

  while (Date.now() - start < maxWaitMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === 'complete') return;
    } catch {
      return; // Tab might have closed
    }
    await new Promise(r => setTimeout(r, checkInterval));
  }
}

async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return result.settings ? { ...DEFAULT_SETTINGS, ...result.settings } : DEFAULT_SETTINGS;
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

function describeAction(action: ComputerAction): string {
  switch (action.action) {
    case 'screenshot': return 'Screenshot';
    case 'left_click': return 'Click';
    case 'right_click': return 'Right-click';
    case 'double_click': return 'Double-click';
    case 'middle_click': return 'Middle-click';
    case 'triple_click': return 'Triple-click';
    case 'type': return `Type "${action.text.substring(0, 30)}${action.text.length > 30 ? '...' : ''}"`;
    case 'key': return `Press ${action.text}`;
    case 'scroll': return 'Scroll';
    case 'wait': return 'Wait';
    case 'mouse_move': return 'Move mouse';
    case 'left_click_drag': return 'Drag';
    default: return 'Action';
  }
}
