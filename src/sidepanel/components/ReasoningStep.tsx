import React, { useState } from 'react';
import { AgentStep } from '../../types/agent';

interface Props {
  step: AgentStep;
  index: number;
}

export default function ReasoningStep({ step, index }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isError = step.status === 'error';
  const isActive = step.status === 'acting' || step.status === 'thinking';
  const hasScreenshot = step.screenshot && !isActive;

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isError
          ? 'border-red-200 bg-red-50'
          : isActive
            ? 'border-tan-300 bg-tan-100'
            : 'border-tan-200 bg-white'
      }`}
    >
      {/* Step header row */}
      <div className="flex items-start gap-2 px-3 py-2">
        {/* Status indicator */}
        <div className="shrink-0 mt-0.5">
          {isActive ? (
            <div className="w-4 h-4 rounded-full border-2 border-tan-400 border-t-transparent animate-spin" />
          ) : isError ? (
            <div className="w-4 h-4 rounded-full bg-red-400 flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">!</span>
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full bg-green-400 flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">{index + 1}</span>
            </div>
          )}
        </div>

        {/* Action + reasoning */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-tan-900 font-karla truncate">
            {step.action ? step.actionDetail || step.action : 'Thinking...'}
          </p>
          {step.reasoning && (
            <p className="text-[11px] text-tan-500 font-karla leading-snug mt-0.5 line-clamp-2">
              {step.reasoning}
            </p>
          )}
          {step.error && <p className="text-[11px] text-red-600 font-karla mt-0.5">{step.error}</p>}
        </div>

        {/* Screenshot thumbnail */}
        {hasScreenshot && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 rounded-md overflow-hidden border border-tan-200 hover:border-tan-400
                       transition-colors cursor-pointer group relative"
            title={expanded ? 'Collapse screenshot' : 'Expand screenshot'}
          >
            <img src={step.screenshot} alt="" className="w-14 h-10 object-cover object-top" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <span
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-[10px]
                              drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
              >
                {expanded ? '−' : '+'}
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Expanded screenshot */}
      {hasScreenshot && expanded && (
        <div className="px-3 pb-2">
          <img
            src={step.screenshot}
            alt="Screenshot"
            className="w-full rounded-lg border border-tan-200"
          />
        </div>
      )}
    </div>
  );
}
