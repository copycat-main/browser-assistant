import { create } from 'zustand';
import {
  AgentStatus,
  AgentStep,
  TaskMode,
  ChatMessage,
  PageContext,
  ResearchProgress,
  SWToPanelMessage,
} from '../../types/agent';

interface AgentState {
  status: AgentStatus;
  steps: AgentStep[];
  currentView: 'main' | 'settings';
  taskMode: TaskMode | null;
  chatMessages: ChatMessage[];
  streamingText: string;
  pageContext: PageContext | null;
  researchProgress: ResearchProgress | null;

  // Actions
  setStatus: (status: AgentStatus) => void;
  addStep: (step: AgentStep) => void;
  updateStep: (stepId: string, updates: Partial<AgentStep>) => void;
  clearAll: () => void;
  setView: (view: 'main' | 'settings') => void;
  setTaskMode: (mode: TaskMode | null) => void;
  addChatMessage: (message: ChatMessage) => void;
  appendStreamText: (text: string) => void;
  clearStreamText: () => void;
  setPageContext: (context: PageContext | null) => void;
  setResearchProgress: (progress: ResearchProgress | null) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  status: 'idle',
  steps: [],
  currentView: 'main',
  taskMode: null,
  chatMessages: [],
  streamingText: '',
  pageContext: null,
  researchProgress: null,

  setStatus: (status) => set({ status }),
  addStep: (step) => set((state) => ({ steps: [...state.steps, step] })),
  updateStep: (stepId, updates) =>
    set((state) => ({
      steps: state.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)),
    })),
  clearAll: () =>
    set({
      steps: [],
      chatMessages: [],
      streamingText: '',
      taskMode: null,
      researchProgress: null,
    }),
  setView: (view) => set({ currentView: view }),
  setTaskMode: (mode) => set({ taskMode: mode }),
  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),
  appendStreamText: (text) =>
    set((state) => ({
      streamingText: state.streamingText + text,
    })),
  clearStreamText: () => set({ streamingText: '' }),
  setPageContext: (context) => set({ pageContext: context }),
  setResearchProgress: (progress) => set({ researchProgress: progress }),
}));

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message: SWToPanelMessage) => {
  const store = useAgentStore.getState();

  switch (message.type) {
    case 'AGENT_STEP':
      store.addStep(message.step);
      break;
    case 'AGENT_STEP_UPDATE':
      store.updateStep(message.stepId, message.updates);
      break;
    case 'AGENT_COMPLETE':
      store.setStatus('idle');
      store.clearStreamText();
      break;
    case 'AGENT_ERROR':
      store.setStatus('error');
      store.clearStreamText();
      // Add as a step (for automate view)
      store.addStep({
        id: `error_${Date.now()}`,
        timestamp: Date.now(),
        reasoning: message.error,
        status: 'error',
        error: message.error,
      });
      // Also add as a chat message (for chat/extract/research/navigate views)
      store.addChatMessage({
        id: `error_msg_${Date.now()}`,
        role: 'assistant',
        content: `Something went wrong: ${message.error}`,
        timestamp: Date.now(),
      });
      break;
    case 'AGENT_STATE':
      store.setStatus(message.status);
      break;
    case 'TASK_MODE':
      store.setTaskMode(message.mode);
      break;
    case 'STREAM_DELTA':
      store.appendStreamText(message.text);
      break;
    case 'STREAM_DONE':
      // Stream is done, keep the text for final render
      break;
    case 'CHAT_MESSAGE':
      store.addChatMessage(message.message);
      break;
    case 'RESEARCH_PROGRESS':
      store.setResearchProgress(message.progress);
      break;
    case 'PAGE_CONTEXT':
      store.setPageContext(message.context);
      break;
  }
});
