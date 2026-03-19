import {
  AgentStatus,
  ChatMessage,
  PanelToSWMessage,
  SWToPanelMessage,
  TaskMode,
} from '../types/agent';
import { Settings, DEFAULT_SETTINGS } from '../types/settings';
import { classifyIntent } from '../services/router';
import { getPageContext } from '../services/pageContext';
import { handleChat } from '../services/modes/chat';
import { handleExtract } from '../services/modes/extract';
import { handleResearch } from '../services/modes/research';
import { handleAutomate } from '../services/modes/automate';
import { loadPageContext, savePageContext, buildContextSummary } from '../services/contextCache';

let agentStatus: AgentStatus = 'idle';
let currentMode: TaskMode | null = null;
let abortController: AbortController | null = null;

// Conversation history maintained in the service worker
let conversationHistory: ChatMessage[] = [];
const MAX_HISTORY_MESSAGES = 40; // 20 turns (user + assistant pairs)

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
    case 'CLEAR_CHAT':
      conversationHistory = [];
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

function addToHistory(message: ChatMessage) {
  conversationHistory.push(message);
  // Trim oldest messages if over budget
  if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
    conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
  }
}

async function startAgent(prompt: string) {
  if (agentStatus === 'running') return;

  agentStatus = 'running';
  currentMode = null;
  abortController = new AbortController();

  const settings = await loadSettings();

  if (!settings.apiKey) {
    broadcast({
      type: 'AGENT_ERROR',
      error: 'No API key configured. Please add your Anthropic API key in settings.',
    });
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

    // Load cached context for this page (from prior sessions)
    let cachedContext = '';
    if (conversationHistory.length === 0) {
      // Only load cache if this is a fresh conversation (no in-memory history)
      try {
        const cached = await loadPageContext(pageContext.url);
        if (cached) {
          cachedContext = buildContextSummary(cached);
        }
      } catch {
        // Cache miss is fine
      }
    }

    // Track the user message in history
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };
    addToHistory(userMessage);

    // Classify intent
    const mode = await classifyIntent(settings.apiKey, prompt, pageContext, abortController.signal);

    currentMode = mode;
    broadcast({ type: 'TASK_MODE', mode });

    // Wrap broadcast to capture assistant messages into history
    const historyBroadcast = (msg: SWToPanelMessage) => {
      if (msg.type === 'CHAT_MESSAGE' && msg.message.role === 'assistant') {
        addToHistory(msg.message);
      }
      broadcast(msg);
    };

    // Pass conversation history to chat/extract modes (they benefit from context)
    const history = [...conversationHistory];

    // Dispatch to appropriate handler
    switch (mode) {
      case 'chat':
        await handleChat(
          settings.apiKey,
          prompt,
          pageContext,
          historyBroadcast,
          abortController.signal,
          settings.characteristic,
          history,
          cachedContext,
        );
        break;

      case 'extract':
        await handleExtract(
          settings.apiKey,
          prompt,
          pageContext,
          tabId,
          historyBroadcast,
          abortController.signal,
          settings.characteristic,
          history,
        );
        break;

      case 'research':
        await handleResearch(
          settings.apiKey,
          prompt,
          pageContext,
          historyBroadcast,
          abortController.signal,
          settings.characteristic,
          sendGlow,
        );
        break;

      case 'automate':
        await handleAutomate(
          prompt,
          tabId,
          settings,
          historyBroadcast,
          sendGlow,
          abortController.signal,
        );
        break;
    }

    // Save conversation to page context cache after successful completion
    try {
      await savePageContext(pageContext.url, pageContext.title, conversationHistory);
    } catch {
      // Cache save failure is non-critical
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
  if (show) {
    injectGlow(tabId);
  } else {
    removeGlow(tabId);
  }
}

function injectGlow(tabId: number) {
  const func = () => {
    if (document.getElementById('copycat-glow')) return;

    const el = document.createElement('div');
    el.id = 'copycat-glow';
    el.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;pointer-events:none;' +
      'border:2px solid rgba(180,130,70,0.7);' +
      'box-shadow:inset 0 0 60px 20px rgba(180,130,70,0.35), inset 0 0 120px 50px rgba(180,130,70,0.15);' +
      'opacity:0;transition:opacity 0.4s ease;';
    document.documentElement.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
    });

    const banner = document.createElement('div');
    banner.id = 'copycat-banner';
    banner.textContent = 'CopyCat is currently controlling this browser';
    banner.style.cssText =
      'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
      'pointer-events:none;background:rgba(180,130,70,0.85);color:#fff;font-family:-apple-system,sans-serif;' +
      'font-size:13px;font-weight:600;padding:6px 18px;border-radius:20px;' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.15);opacity:0;transition:opacity 0.4s ease;';
    document.documentElement.appendChild(banner);
    requestAnimationFrame(() => {
      banner.style.opacity = '1';
    });
  };

  // Try debugger first (works when attached in automate mode), fall back to scripting API
  chrome.debugger
    .sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `(${func.toString()})()`,
      returnByValue: true,
    })
    .catch(() => {
      chrome.scripting.executeScript({ target: { tabId }, func }).catch(() => {});
    });
}

function removeGlow(tabId: number) {
  const func = () => {
    const el = document.getElementById('copycat-glow');
    if (el) {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }
    const banner = document.getElementById('copycat-banner');
    if (banner) {
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.3s ease';
      setTimeout(() => banner.remove(), 300);
    }
  };

  chrome.debugger
    .sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `(${func.toString()})()`,
      returnByValue: true,
    })
    .catch(() => {
      chrome.scripting.executeScript({ target: { tabId }, func }).catch(() => {});
    });
}

async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return result.settings ? { ...DEFAULT_SETTINGS, ...result.settings } : DEFAULT_SETTINGS;
}
