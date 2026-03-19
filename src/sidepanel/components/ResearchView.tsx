import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { useAutoScroll } from '../hooks/useAutoScroll';
import FormattedOutput from './FormattedOutput';

const STAGE_LABELS: Record<string, string> = {
  planning: 'Planning research...',
  searching: 'Searching the web...',
  reading: 'Reading sources...',
  synthesizing: 'Putting it all together...',
  done: 'Research complete',
};

const STAGE_ICONS: Record<string, string> = {
  planning: '🧠',
  searching: '🔍',
  reading: '📖',
  synthesizing: '✨',
  done: '✅',
};

export default function ResearchView() {
  const chatMessages = useAgentStore((s) => s.chatMessages);
  const streamingText = useAgentStore((s) => s.streamingText);
  const researchProgress = useAgentStore((s) => s.researchProgress);
  const status = useAgentStore((s) => s.status);
  const scrollRef = useAutoScroll([chatMessages.length, streamingText, researchProgress?.stage]);

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
          {/* Stage indicator */}
          <div className="flex items-center gap-2">
            <span className="text-base">{STAGE_ICONS[researchProgress.stage] || '🔄'}</span>
            <span className="text-sm font-semibold text-tan-800 font-karla">
              {STAGE_LABELS[researchProgress.stage] || researchProgress.stage}
            </span>
          </div>

          {/* Detail */}
          <p className="text-xs text-tan-600 font-karla">{researchProgress.detail}</p>

          {/* Sources found */}
          {researchProgress.sources && researchProgress.sources.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-tan-100">
              <p className="text-[11px] text-tan-400 font-karla uppercase tracking-wider">
                Sources
              </p>
              {researchProgress.sources.map((source, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-tan-600 font-karla">
                  <span className="text-tan-400">📄</span>
                  <span className="truncate">{source.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar animation */}
          {researchProgress.stage !== 'done' && (
            <div className="h-1 bg-tan-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-tan-400 rounded-full animate-pulse"
                style={{ width: '60%' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Streaming synthesis */}
      {streamingText && (
        <div className="flex justify-start">
          <div className="max-w-[90%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white border border-tan-200">
            <div className="text-sm">
              <FormattedOutput content={streamingText} />
            </div>
            {status === 'running' && (
              <span className="inline-block w-1.5 h-4 bg-tan-400 animate-pulse rounded-sm ml-0.5 -mb-0.5" />
            )}
          </div>
        </div>
      )}

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
