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

  const statusText = {
    idle: 'Done',
    running: 'Working...',
    stopping: 'Stopping...',
    error: 'Error',
  }[status];

  const statusColor = {
    idle: 'bg-green-400',
    running: 'bg-tan-400 animate-pulse',
    stopping: 'bg-yellow-400',
    error: 'bg-red-400',
  }[status];

  const canClear = status === 'idle' || status === 'error';

  const itemCount = taskMode === 'automate' ? steps.length : chatMessages.length;
  const itemLabel = taskMode === 'automate'
    ? `${itemCount} step${itemCount !== 1 ? 's' : ''}`
    : `${itemCount} message${itemCount !== 1 ? 's' : ''}`;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-tan-700 font-karla">
      <div className={`w-2 h-2 rounded-full ${statusColor}`} />
      <span>{statusText}</span>
      {itemCount > 0 && (
        <>
          <span className="text-tan-300">|</span>
          <span>{itemLabel}</span>
        </>
      )}
      {canClear && hasContent && (
        <>
          <span className="text-tan-300">|</span>
          <button
            onClick={clearAll}
            className="text-tan-500 hover:text-tan-700 transition-colors"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}
