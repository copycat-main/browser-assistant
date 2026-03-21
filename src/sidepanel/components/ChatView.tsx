import React, { useRef, useEffect } from 'react';
import { useAgentStore } from '../store/agentStore';
import { useAutoScroll } from '../hooks/useAutoScroll';
import FormattedOutput from './FormattedOutput';
import StreamingBubble from './StreamingBubble';

export default function ChatView() {
  const chatMessages = useAgentStore((s) => s.chatMessages);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const status = useAgentStore((s) => s.status);
  const scrollRef = useAutoScroll([chatMessages.length, isStreaming]);

  const showThinking =
    status === 'running' &&
    !isStreaming &&
    chatMessages.length > 0 &&
    chatMessages[chatMessages.length - 1].role === 'user';

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
      {chatMessages.map((msg, index) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          isLatest={index === chatMessages.length - 1 && status === 'idle'}
        />
      ))}

      {/* Streaming text — DOM-driven, no React re-renders */}
      {isStreaming && status === 'running' && <StreamingBubble />}

      {/* Thinking indicator */}
      {showThinking && (
        <div className="flex justify-start animate-fade-in">
          <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white border border-tan-200">
            <div className="flex gap-1.5 items-center py-0.5">
              <span className="w-1.5 h-1.5 bg-tan-400 rounded-full animate-thinking-dot" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-tan-400 rounded-full animate-thinking-dot" style={{ animationDelay: '200ms' }} />
              <span className="w-1.5 h-1.5 bg-tan-400 rounded-full animate-thinking-dot" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  role,
  content,
  isLatest,
}: {
  role: 'user' | 'assistant';
  content: string;
  isLatest: boolean;
}) {
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLatest && bubbleRef.current) {
      bubbleRef.current.classList.add('animate-message-in');
    }
  }, [isLatest]);

  return (
    <div ref={bubbleRef} className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
          role === 'user'
            ? 'bg-tan-400 text-white rounded-br-md'
            : 'bg-white border border-tan-200 rounded-bl-md'
        }`}
      >
        {role === 'user' ? (
          <p className="text-sm font-karla leading-relaxed">{content}</p>
        ) : (
          <div className="text-sm">
            <FormattedOutput content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
