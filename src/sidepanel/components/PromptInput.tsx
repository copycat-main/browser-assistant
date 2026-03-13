import React, { useState, useRef } from 'react';
import { useAgentLoop } from '../hooks/useAgentLoop';

export default function PromptInput() {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { status, startAgent, stopAgent } = useAgentLoop();

  const isRunning = status === 'running' || status === 'stopping';

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning) return;
    startAgent(trimmed);
    setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-3 pb-3 pt-2 border-t border-tan-200 bg-tan-50">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? 'Agent is working...' : 'What should I do?'}
          disabled={isRunning}
          rows={2}
          className="flex-1 resize-none rounded-xl border border-tan-200 bg-white px-3 py-2 text-sm
                     placeholder:text-tan-300 focus:outline-none focus:ring-2 focus:ring-tan-400
                     disabled:opacity-50 font-karla"
        />
        {isRunning ? (
          <button
            onClick={stopAgent}
            disabled={status === 'stopping'}
            className="shrink-0 rounded-xl bg-red-500 hover:bg-red-600 text-white px-4 py-2
                       text-sm font-semibold transition-colors disabled:opacity-50 font-karla"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="shrink-0 rounded-xl bg-tan-400 hover:bg-tan-500 text-white px-4 py-2
                       text-sm font-semibold transition-colors disabled:opacity-50 font-karla"
          >
            Go
          </button>
        )}
      </div>
    </div>
  );
}
