import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { useAutoScroll } from '../hooks/useAutoScroll';
import ReasoningStep from './ReasoningStep';

export default function ReasoningChain() {
  const steps = useAgentStore((s) => s.steps);
  const chatMessages = useAgentStore((s) => s.chatMessages);
  const lastStep = steps[steps.length - 1];
  const scrollRef = useAutoScroll([steps.length, lastStep?.screenshot, lastStep?.status]);

  // Show only the latest user prompt (not old conversation messages from prior modes)
  const lastUserMsg = [...chatMessages].reverse().find((m) => m.role === 'user');

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      {/* Show latest user prompt at top */}
      {lastUserMsg && (
        <div key={lastUserMsg.id} className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 bg-tan-400 text-white">
            <p className="text-sm font-karla leading-relaxed">{lastUserMsg.content}</p>
          </div>
        </div>
      )}

      {/* Steps */}
      {steps.map((step, i) => (
        <ReasoningStep key={step.id} step={step} index={i} />
      ))}
    </div>
  );
}
