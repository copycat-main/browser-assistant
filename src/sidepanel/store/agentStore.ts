import { create } from 'zustand';
import { AgentStatus, AgentStep, SWToPanelMessage } from '../../types/agent';

interface AgentState {
  status: AgentStatus;
  steps: AgentStep[];
  currentView: 'main' | 'settings';

  // Actions
  setStatus: (status: AgentStatus) => void;
  addStep: (step: AgentStep) => void;
  updateStep: (stepId: string, updates: Partial<AgentStep>) => void;
  clearSteps: () => void;
  setView: (view: 'main' | 'settings') => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  status: 'idle',
  steps: [],
  currentView: 'main',

  setStatus: (status) => set({ status }),
  addStep: (step) => set((state) => ({ steps: [...state.steps, step] })),
  updateStep: (stepId, updates) =>
    set((state) => ({
      steps: state.steps.map((s) =>
        s.id === stepId ? { ...s, ...updates } : s
      ),
    })),
  clearSteps: () => set({ steps: [] }),
  setView: (view) => set({ currentView: view }),
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
      break;
    case 'AGENT_ERROR':
      store.setStatus('error');
      store.addStep({
        id: `error_${Date.now()}`,
        timestamp: Date.now(),
        reasoning: message.error,
        status: 'error',
        error: message.error,
      });
      break;
    case 'AGENT_STATE':
      store.setStatus(message.status);
      break;
  }
});
