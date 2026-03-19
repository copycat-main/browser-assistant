import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { useAgentLoop } from '../hooks/useAgentLoop';

export default function Header() {
  const setView = useAgentStore((s) => s.setView);
  const chatMessages = useAgentStore((s) => s.chatMessages);
  const steps = useAgentStore((s) => s.steps);
  const status = useAgentStore((s) => s.status);
  const { clearChat } = useAgentLoop();

  const hasConversation = chatMessages.length > 0 || steps.length > 0;
  const canStartNew = hasConversation && (status === 'idle' || status === 'error');

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-tan-200 bg-tan-50">
      <div className="flex items-center gap-2">
        <img src="/icons/icon-48.png" alt="CopyCat" className="w-7 h-7" />
        <h1 className="text-lg font-bold text-tan-900 font-karla">CopyCat</h1>
      </div>
      <div className="flex items-center gap-1.5">
        {canStartNew && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                       text-tan-600 hover:bg-tan-100 transition-colors font-karla"
            title="New Chat"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            New
          </button>
        )}
        <button
          onClick={() => setView('settings')}
          className="p-2 rounded-lg hover:bg-tan-100 transition-colors text-tan-700"
          title="Settings"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </div>
    </div>
  );
}
