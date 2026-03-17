export type AgentStatus = 'idle' | 'running' | 'stopping' | 'error';

export type TaskMode = 'chat' | 'research' | 'extract' | 'automate';

export interface PageContext {
  url: string;
  title: string;
  favicon: string;
  selectedText: string;
  domain: string;
}

export interface AgentStep {
  id: string;
  timestamp: number;
  reasoning: string;
  action?: string;
  actionDetail?: string;
  screenshot?: string;
  status: 'thinking' | 'acting' | 'complete' | 'error';
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ResearchProgress {
  stage: 'planning' | 'searching' | 'reading' | 'synthesizing' | 'done';
  detail: string;
  sources?: { title: string; url: string }[];
}

// Messages: Side Panel → Service Worker
export type PanelToSWMessage =
  | { type: 'START_AGENT'; prompt: string }
  | { type: 'STOP_AGENT' }
  | { type: 'GET_STATE' }
  | { type: 'GET_PAGE_CONTEXT' };

// Messages: Service Worker → Side Panel
export type SWToPanelMessage =
  | { type: 'AGENT_STEP'; step: AgentStep }
  | { type: 'AGENT_STEP_UPDATE'; stepId: string; updates: Partial<AgentStep> }
  | { type: 'AGENT_COMPLETE' }
  | { type: 'AGENT_ERROR'; error: string }
  | { type: 'AGENT_STATE'; status: AgentStatus; steps: AgentStep[] }
  | { type: 'TASK_MODE'; mode: TaskMode }
  | { type: 'STREAM_DELTA'; text: string }
  | { type: 'STREAM_DONE'; fullText: string }
  | { type: 'CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'RESEARCH_PROGRESS'; progress: ResearchProgress }
  | { type: 'PAGE_CONTEXT'; context: PageContext };
