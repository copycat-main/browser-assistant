import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { useAutoScroll } from '../hooks/useAutoScroll';
import FormattedOutput from './FormattedOutput';

export default function ChatView() {
  const chatMessages = useAgentStore((s) => s.chatMessages);
  const streamingText = useAgentStore((s) => s.streamingText);
  const status = useAgentStore((s) => s.status);
  const scrollRef = useAutoScroll([chatMessages.length, streamingText]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
      {chatMessages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
              msg.role === 'user'
                ? 'bg-tan-400 text-white rounded-br-md'
                : 'bg-white border border-tan-200 rounded-bl-md'
            }`}
          >
            {msg.role === 'user' ? (
              <p className="text-sm font-karla leading-relaxed">{msg.content}</p>
            ) : (
              <div className="text-sm">
                <FormattedOutput content={msg.content} />
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Streaming text (not yet committed to messages) */}
      {streamingText && status === 'running' && (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white border border-tan-200">
            <div className="text-sm">
              <FormattedOutput content={streamingText} />
            </div>
            <span className="inline-block w-1.5 h-4 bg-tan-400 animate-pulse rounded-sm ml-0.5 -mb-0.5" />
          </div>
        </div>
      )}

      {/* Thinking indicator */}
      {status === 'running' && !streamingText && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'user' && (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white border border-tan-200">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-tan-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-tan-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-tan-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
