import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { useAutoScroll } from '../hooks/useAutoScroll';
import FormattedOutput from './FormattedOutput';
import StreamingBubble from './StreamingBubble';

const STAGE_LABELS: Record<string, string> = {
  planning: 'Planning research...',
  searching: 'Searching the web...',
  reading: 'Reading sources...',
  synthesizing: 'Putting it all together...',
  done: 'Research complete',
};

const STAGE_ICONS: Record<string, string> = {
  planning: 'psychology',
  searching: 'search',
  reading: 'menu_book',
  synthesizing: 'auto_awesome',
  done: 'check_circle',
};

export default function ResearchView() {
  const chatMessages = useAgentStore((s) => s.chatMessages);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const researchProgress = useAgentStore((s) => s.researchProgress);
  const status = useAgentStore((s) => s.status);
  const scrollRef = useAutoScroll([chatMessages.length, isStreaming, researchProgress?.stage]);

  const hasAssistantMessage = chatMessages.some((m) => m.role === 'assistant');

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
      {/* User message */}
      {chatMessages
        .filter((m) => m.role === 'user')
        .map((msg) => (
          <div key={msg.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 bg-tan-400 text-white">
              <p className="text-sm font-karla leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

      {/* Research progress */}
      {researchProgress && status === 'running' && (
        <div className="rounded-xl border border-tan-200 bg-white p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-rounded text-base text-tan-600"
              style={{ fontSize: '20px' }}
            >
              {STAGE_ICONS[researchProgress.stage] || 'sync'}
            </span>
            <span className="text-sm font-semibold text-tan-800 font-karla">
              {STAGE_LABELS[researchProgress.stage] || researchProgress.stage}
            </span>
          </div>

          <p className="text-xs text-tan-600 font-karla">{researchProgress.detail}</p>

          {researchProgress.sources && researchProgress.sources.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-tan-100">
              <p className="text-[11px] text-tan-400 font-karla uppercase tracking-wider">
                Sources
              </p>
              {researchProgress.sources.map((source, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-tan-600 font-karla">
                  <span className="material-symbols-rounded text-tan-400" style={{ fontSize: '16px' }}>
                    description
                  </span>
                  <span className="truncate">{source.title}</span>
                </div>
              ))}
            </div>
          )}

          {researchProgress.stage !== 'done' && (
            <div className="h-1 bg-tan-100 rounded-full overflow-hidden">
              <div className="h-full bg-tan-400 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          )}
        </div>
      )}

      {/* Streaming synthesis — only show if no completed assistant message yet */}
      {isStreaming && !hasAssistantMessage && <StreamingBubble />}

      {/* Completed assistant messages */}
      {chatMessages
        .filter((m) => m.role === 'assistant')
        .map((msg) => (
          <div key={msg.id} className="flex justify-start">
            <div className="max-w-[90%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white border border-tan-200">
              <div className="text-sm">
                <FormattedOutput content={msg.content} />
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
