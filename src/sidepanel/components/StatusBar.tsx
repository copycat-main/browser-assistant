import React from 'react';
import { useAgentStore } from '../store/agentStore';

export default function StatusBar() {
  const status = useAgentStore((s) => s.status);
  const steps = useAgentStore((s) => s.steps);
  const clearSteps = useAgentStore((s) => s.clearSteps);

  if (status === 'idle' && steps.length === 0) return null;

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

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-tan-700 font-karla">
      <div className={`w-2 h-2 rounded-full ${statusColor}`} />
      <span>{statusText}</span>
      <span className="text-tan-300">|</span>
      <span>{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
      {canClear && (
        <>
          <span className="text-tan-300">|</span>
          <button
            onClick={clearSteps}
            className="text-tan-500 hover:text-tan-700 transition-colors"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}
