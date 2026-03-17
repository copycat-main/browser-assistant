import { AgentStatus, PanelToSWMessage, SWToPanelMessage, TaskMode } from '../types/agent';
import { Settings, DEFAULT_SETTINGS } from '../types/settings';
import { classifyIntent } from '../services/router';
import { getPageContext } from '../services/pageContext';
import { handleChat } from '../services/modes/chat';
import { handleExtract } from '../services/modes/extract';
import { handleResearch } from '../services/modes/research';
import { handleAutomate } from '../services/modes/automate';

let agentStatus: AgentStatus = 'idle';
let currentMode: TaskMode | null = null;
let abortController: AbortController | null = null;

// Handle CDP events: page navigations
chrome.debugger.onEvent.addListener(async (source, method) => {
  if (!source.tabId || agentStatus !== 'running') return;
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
      sendResponse({ status: agentStatus, mode: currentMode });
      break;
    case 'GET_PAGE_CONTEXT':
      handleGetPageContext().then(sendResponse);
      return true; // async response
  }
  return true;
});

async function handleGetPageContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  return getPageContext(tab.id);
}

function broadcast(message: SWToPanelMessage) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

async function startAgent(prompt: string) {
  if (agentStatus === 'running') return;

  agentStatus = 'running';
  currentMode = null;
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
    // Get page context
    const pageContext = await getPageContext(tabId);

    // Classify intent
    const mode = await classifyIntent(
      settings.apiKey,
      settings.model,
      prompt,
      pageContext,
      abortController.signal
    );

    currentMode = mode;
    broadcast({ type: 'TASK_MODE', mode });

    // Dispatch to appropriate handler
    switch (mode) {
      case 'chat':
        await handleChat(settings.apiKey, settings.model, prompt, pageContext, broadcast, abortController.signal);
        break;

      case 'extract':
        await handleExtract(settings.apiKey, settings.model, prompt, pageContext, tabId, broadcast, abortController.signal);
        break;

      case 'research':
        await handleResearch(settings.apiKey, settings.model, prompt, pageContext, broadcast, abortController.signal);
        break;

      case 'automate':
        await handleAutomate(prompt, tabId, settings, broadcast, sendGlow, abortController.signal);
        break;
    }

    agentStatus = 'idle';
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
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        \`;
        document.head.appendChild(style);

        const el = document.createElement('div');
        el.id = 'copycat-glow';
        el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;' +
          'border:3px solid rgba(180,130,70,0.7);' +
          'box-shadow:inset 0 0 50px 20px rgba(180,130,70,0.35), inset 0 0 100px 40px rgba(180,130,70,0.15);' +
          'animation:copycatPulse 3s ease-in-out infinite;';
        document.documentElement.appendChild(el);

        const banner = document.createElement('div');
        banner.id = 'copycat-banner';
        banner.textContent = 'CopyCat is currently controlling this browser';
        banner.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
          'pointer-events:none;background:rgba(180,130,70,0.85);color:#fff;font-family:-apple-system,sans-serif;' +
          'font-size:13px;font-weight:600;padding:6px 18px;border-radius:20px;' +
          'box-shadow:0 2px 8px rgba(0,0,0,0.15);animation:copycatPulse 3s ease-in-out infinite;';
        document.documentElement.appendChild(banner);
      })()`
    : `(function() {
        const el = document.getElementById('copycat-glow');
        if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s ease'; setTimeout(() => el.remove(), 300); }
        const banner = document.getElementById('copycat-banner');
        if (banner) { banner.style.opacity = '0'; banner.style.transition = 'opacity 0.3s ease'; setTimeout(() => banner.remove(), 300); }
        const style = document.getElementById('copycat-glow-style');
        if (style) setTimeout(() => style.remove(), 300);
      })()`;

  chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
    expression: script,
    returnByValue: true,
  }).catch(() => {});
}

async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return result.settings ? { ...DEFAULT_SETTINGS, ...result.settings } : DEFAULT_SETTINGS;
}
