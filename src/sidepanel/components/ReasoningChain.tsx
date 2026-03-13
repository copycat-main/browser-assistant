import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { useAutoScroll } from '../hooks/useAutoScroll';
import ReasoningStep from './ReasoningStep';

export default function ReasoningChain() {
  const steps = useAgentStore((s) => s.steps);
  const lastStep = steps[steps.length - 1];
  const scrollRef = useAutoScroll([steps.length, lastStep?.screenshot, lastStep?.status]);

  if (steps.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <img
            src="/icons/icon-128.png"
            alt="CopyCat"
            className="w-16 h-16 mx-auto opacity-40"
          />
          <p className="text-sm text-tan-400 font-karla">
            Tell me what to do on this page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
      {steps.map((step, i) => (
        <ReasoningStep key={step.id} step={step} index={i} />
      ))}
    </div>
  );
}
