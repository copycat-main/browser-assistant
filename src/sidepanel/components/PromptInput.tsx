import React, { useState, useRef, useEffect } from 'react';
import { useAgentLoop } from '../hooks/useAgentLoop';

interface Props {
  prefillPrompt?: string;
  onPromptUsed?: () => void;
}

export default function PromptInput({ prefillPrompt, onPromptUsed }: Props) {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { status, startAgent, stopAgent } = useAgentLoop();

  const isRunning = status === 'running' || status === 'stopping';

  // Handle prefill from landing page
  useEffect(() => {
    if (prefillPrompt) {
      setPrompt(prefillPrompt);
      onPromptUsed?.();
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [prefillPrompt, onPromptUsed]);

  // Auto-resize textarea: grow up to max, then allow internal scroll
  const MAX_HEIGHT = 120;
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const natural = el.scrollHeight;
    const clamped = Math.min(natural, MAX_HEIGHT);
    el.style.height = clamped + 'px';
    // Only allow scrolling when content exceeds max height
    el.style.overflowY = natural > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [prompt]);

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
          placeholder={isRunning ? 'Working on it...' : 'Ask anything or tell me what to do...'}
          disabled={isRunning}
          rows={1}
          className="prompt-input flex-1 resize-none rounded-xl border border-tan-200 bg-white px-3 py-2 text-sm
                     placeholder:text-tan-300 focus:outline-none focus:ring-2 focus:ring-tan-400
                     disabled:opacity-50 font-karla leading-relaxed"
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
