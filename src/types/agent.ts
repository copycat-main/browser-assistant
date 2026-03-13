export type AgentStatus = 'idle' | 'running' | 'stopping' | 'error';

export interface AgentStep {
  id: string;
  timestamp: number;
  reasoning: string;
  action?: string;
  actionDetail?: string;
  screenshot?: string; // base64 data URL
  status: 'thinking' | 'acting' | 'complete' | 'error';
  error?: string;
}

// Messages: Side Panel → Service Worker
export type PanelToSWMessage =
  | { type: 'START_AGENT'; prompt: string }
  | { type: 'STOP_AGENT' }
  | { type: 'GET_STATE' };

// Messages: Service Worker → Side Panel
export type SWToPanelMessage =
  | { type: 'AGENT_STEP'; step: AgentStep }
  | { type: 'AGENT_STEP_UPDATE'; stepId: string; updates: Partial<AgentStep> }
  | { type: 'AGENT_COMPLETE' }
  | { type: 'AGENT_ERROR'; error: string }
  | { type: 'AGENT_STATE'; status: AgentStatus; steps: AgentStep[] };

// Messages: Service Worker → Content Script
export type SWToContentMessage =
  | { type: 'GET_PAGE_INFO' };

export interface PageInfo {
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
  title: string;
  url: string;
}
