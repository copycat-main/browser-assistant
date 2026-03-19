import React from 'react';
import { AgentStep } from '../../types/agent';

interface Props {
  step: AgentStep;
  index: number;
}

export default function ReasoningStep({ step, index }: Props) {
  const borderColor = step.status === 'error' ? 'border-red-300' : 'border-tan-200';
  const bgColor = step.status === 'error' ? 'bg-red-50' : 'bg-tan-100';

  return (
    <div
      className={`rounded-lg border ${borderColor} ${bgColor} overflow-hidden px-2.5 py-2 space-y-1`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-tan-400 font-mono w-4 shrink-0">
          {step.status === 'acting' || step.status === 'thinking' ? (
            <span className="inline-block animate-spin">~</span>
          ) : step.status === 'error' ? (
            <span className="text-red-500 font-bold">!</span>
          ) : (
            <span className="text-green-600">{index + 1}</span>
          )}
        </span>
        <span className="flex-1 text-xs font-medium text-tan-900 truncate font-karla">
          {step.action ? step.actionDetail || step.action : 'Thinking...'}
        </span>
      </div>

      {step.reasoning && (
        <p className="text-[11px] text-tan-700 leading-snug whitespace-pre-wrap font-karla">
          {step.reasoning}
        </p>
      )}
      {step.error && (
        <p className="text-[11px] text-red-600 font-medium font-karla">{step.error}</p>
      )}
      {step.screenshot && step.status !== 'thinking' && (
        <img
          src={step.screenshot}
          alt="Screenshot"
          className="w-full rounded border border-tan-200 mt-1"
        />
      )}
    </div>
  );
}
