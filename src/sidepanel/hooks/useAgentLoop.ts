import { useCallback } from 'react';
import { useAgentStore } from '../store/agentStore';

export function useAgentLoop() {
  const { status, steps, setStatus, clearSteps } = useAgentStore();

  const startAgent = useCallback(async (prompt: string) => {
    clearSteps();
    setStatus('running');
    await chrome.runtime.sendMessage({ type: 'START_AGENT', prompt });
  }, [clearSteps, setStatus]);

  const stopAgent = useCallback(async () => {
    setStatus('stopping');
    await chrome.runtime.sendMessage({ type: 'STOP_AGENT' });
  }, [setStatus]);

  return { status, steps, startAgent, stopAgent };
}
