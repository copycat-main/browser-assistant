import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { useAutoScroll } from '../hooks/useAutoScroll';
import ReasoningStep from './ReasoningStep';

export default function ReasoningChain() {
  const steps = useAgentStore((s) => s.steps);
  const lastStep = steps[steps.length - 1];
  const scrollRef = useAutoScroll([steps.length, lastStep?.screenshot, lastStep?.status]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
      {steps.map((step, i) => (
        <ReasoningStep key={step.id} step={step} index={i} />
      ))}
    </div>
  );
}
