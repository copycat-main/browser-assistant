import { useCallback } from 'react';
import { useAgentStore } from '../store/agentStore';

export function useAgentLoop() {
  const { status, steps, setStatus, clearAll, clearStreamText } = useAgentStore();

  const startAgent = useCallback(async (prompt: string) => {
    // Don't clear conversation — just reset streaming state for the new message
    clearStreamText();
    setStatus('running');
    await chrome.runtime.sendMessage({ type: 'START_AGENT', prompt });
  }, [clearStreamText, setStatus]);

  const stopAgent = useCallback(async () => {
    setStatus('stopping');
    await chrome.runtime.sendMessage({ type: 'STOP_AGENT' });
  }, [setStatus]);

  const clearChat = useCallback(async () => {
    clearAll();
    // Tell the service worker to clear its conversation history too
    await chrome.runtime.sendMessage({ type: 'CLEAR_CHAT' });
  }, [clearAll]);

  return { status, steps, startAgent, stopAgent, clearChat };
}
