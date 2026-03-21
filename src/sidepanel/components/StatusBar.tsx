import React from 'react';
import { useAgentStore } from '../store/agentStore';

export default function StatusBar() {
  const status = useAgentStore((s) => s.status);
  const steps = useAgentStore((s) => s.steps);
  const chatMessages = useAgentStore((s) => s.chatMessages);
  const taskMode = useAgentStore((s) => s.taskMode);
  const clearAll = useAgentStore((s) => s.clearAll);

  const hasContent = steps.length > 0 || chatMessages.length > 0;
  if (status === 'idle' && !hasContent) return null;

  const handleClear = () => {
    clearAll();
    // Notify service worker to clear its conversation history too
    chrome.runtime.sendMessage({ type: 'CLEAR_CHAT' }).catch(() => {});
  };

  const statusConfig = {
    idle: { label: 'Done', color: 'bg-green-400' },
    running: { label: 'Working...', color: 'bg-tan-400 animate-pulse' },
    stopping: { label: 'Stopping...', color: 'bg-yellow-400' },
    error: { label: 'Error', color: 'bg-red-400' },
  }[status];

  const canClear = status === 'idle' || status === 'error';
  const itemCount = taskMode === 'automate' ? steps.length : chatMessages.length;
  const itemLabel =
    taskMode === 'automate'
      ? `${itemCount} step${itemCount !== 1 ? 's' : ''}`
      : `${itemCount} msg${itemCount !== 1 ? 's' : ''}`;

  return (
    <div className="flex items-center gap-2 px-4 py-1 text-[11px] text-tan-500 font-karla">
      <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.color}`} />
      <span>{statusConfig.label}</span>
      {itemCount > 0 && (
        <>
          <span className="text-tan-300">|</span>
          <span>{itemLabel}</span>
        </>
      )}
      <div className="flex-1" />
      {canClear && hasContent && (
        <button onClick={handleClear} className="text-tan-400 hover:text-tan-600 transition-colors">
          Clear
        </button>
      )}
    </div>
  );
}
