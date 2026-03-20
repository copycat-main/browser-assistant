import React from 'react';
import { AgentStep } from '../../types/agent';

interface Props {
  step: AgentStep;
  index: number;
}

export default function ReasoningStep({ step, index }: Props) {
  const borderColor = step.status === 'error' ? 'border-red-300' : 'border-tan-200';
  const bgColor = step.status === 'error' ? 'bg-red-50' : 'bg-tan-100';

  const isThinking = !step.action && step.status !== 'error';

  return (
    <div
      className={`rounded-lg border ${borderColor} ${bgColor} overflow-hidden ${isThinking ? 'px-2 py-1' : 'px-2.5 py-1.5'} space-y-0.5`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-tan-400 font-mono w-3.5 shrink-0">
          {step.status === 'acting' || step.status === 'thinking' ? (
            <span className="inline-block animate-spin">~</span>
          ) : step.status === 'error' ? (
            <span className="text-red-500 font-bold">!</span>
          ) : (
            <span className="text-green-600">{index + 1}</span>
          )}
        </span>
        <span className={`flex-1 font-medium text-tan-900 truncate font-karla ${isThinking ? 'text-[11px]' : 'text-xs'}`}>
          {step.action ? step.actionDetail || step.action : 'Thinking...'}
        </span>
      </div>

      {step.reasoning && (
        <p className={`text-tan-600 leading-snug font-karla ${isThinking ? 'text-[10px] line-clamp-2' : 'text-[11px]'}`}>
          {step.reasoning}
        </p>
      )}
      {step.error && (
        <p className="text-[10px] text-red-600 font-medium font-karla">{step.error}</p>
      )}
      {step.screenshot && step.status !== 'thinking' && (
        <img
          src={step.screenshot}
          alt="Screenshot"
          className="w-full rounded border border-tan-200 mt-0.5"
        />
      )}
    </div>
  );
}
