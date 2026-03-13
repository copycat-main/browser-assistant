import React from 'react';
import { useAgentStore } from '../store/agentStore';

export default function Header() {
  const setView = useAgentStore((s) => s.setView);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-tan-200 bg-tan-50">
      <div className="flex items-center gap-2">
        <img
          src="/icons/icon-48.png"
          alt="CopyCat"
          className="w-7 h-7"
        />
        <h1 className="text-lg font-bold text-tan-900 font-karla">CopyCat</h1>
      </div>
      <button
        onClick={() => setView('settings')}
        className="p-2 rounded-lg hover:bg-tan-100 transition-colors text-tan-700"
        title="Settings"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>
    </div>
  );
}
