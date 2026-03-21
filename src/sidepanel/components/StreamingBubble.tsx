import React, { useEffect, useRef } from 'react';
import { useAgentStore } from '../store/agentStore';

/**
 * Incremental markdown renderer for streaming text.
 *
 * Completed lines (terminated by \n) are parsed once into styled DOM nodes
 * and never touched again.  The current in-progress line is re-rendered on
 * every flush with live inline formatting (bold, italic, code).
 *
 * Handles fenced code blocks (```) by accumulating lines until the closing
 * fence, then rendering the block as a single <pre>.
 *
 * Zero React re-renders — everything is direct DOM manipulation via a
 * Zustand subscription that fires once per rAF-batched store flush.
 */
export default function StreamingBubble() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    fullText: '',
    finalizedLines: 0,
    inCodeBlock: false,
    codeBlockContent: '',
  });
  const currentLineRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const initial = useAgentStore.getState().streamingText;
    if (initial) {
      stateRef.current.fullText = initial;
      renderIncremental();
    }
  }, []);

  useEffect(() => {
    const unsub = useAgentStore.subscribe((state) => {
      const text = state.streamingText;
      if (text === stateRef.current.fullText) return;

      if (text.length === 0 && stateRef.current.fullText.length > 0) {
        if (containerRef.current) containerRef.current.innerHTML = '';
        stateRef.current = { fullText: '', finalizedLines: 0, inCodeBlock: false, codeBlockContent: '' };
        currentLineRef.current = null;
        return;
      }

      stateRef.current.fullText = text;
      renderIncremental();
    });
    return unsub;
  }, []);

  function renderIncremental() {
    const container = containerRef.current;
    if (!container) return;

    const s = stateRef.current;
    const lines = s.fullText.split('\n');
    const completeLineCount = lines.length - 1;
    const currentLine = lines[lines.length - 1];

    // Remove the current-line element
    if (currentLineRef.current && currentLineRef.current.parentNode === container) {
      container.removeChild(currentLineRef.current);
      currentLineRef.current = null;
    }

    // Render newly completed lines
    for (let i = s.finalizedLines; i < completeLineCount; i++) {
      const line = lines[i];

      if (line.startsWith('```')) {
        if (s.inCodeBlock) {
          // Closing fence — render the accumulated code block
          const pre = document.createElement('pre');
          pre.className = 'bg-tan-100 border border-tan-200 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-tan-800 my-2';
          pre.textContent = s.codeBlockContent.trim();
          container.appendChild(pre);
          s.inCodeBlock = false;
          s.codeBlockContent = '';
        } else {
          // Opening fence
          s.inCodeBlock = true;
          s.codeBlockContent = '';
        }
      } else if (s.inCodeBlock) {
        s.codeBlockContent += line + '\n';
      } else {
        container.appendChild(renderLine(line));
      }
    }
    s.finalizedLines = completeLineCount;

    // Render current in-progress line
    if (s.inCodeBlock) {
      // Show a live code block preview
      const pre = document.createElement('pre');
      pre.className = 'bg-tan-100 border border-tan-200 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-tan-800 my-2 opacity-70';
      pre.textContent = (s.codeBlockContent + currentLine).trim();
      container.appendChild(pre);
      currentLineRef.current = pre;
    } else {
      const span = document.createElement('span');
      renderInlineInto(span, currentLine);
      container.appendChild(span);
      currentLineRef.current = span;
    }
  }

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white border border-tan-200">
        <div
          ref={containerRef}
          className="text-[13px] text-tan-700 font-karla leading-relaxed break-words"
        />
        <span className="streaming-cursor" />
      </div>
    </div>
  );
}

// ── Line-level rendering (finalized lines) ──────────────────────────────────

function renderLine(line: string): HTMLElement {
  if (!line.trim()) {
    const div = document.createElement('div');
    div.className = 'h-2';
    return div;
  }

  if (line.startsWith('### ')) return makeHeader(line.slice(4), 'h4', 'font-semibold text-tan-900 mt-3 mb-1 text-sm font-karla');
  if (line.startsWith('## ')) return makeHeader(line.slice(3), 'h3', 'font-bold text-tan-900 mt-3 mb-1 text-sm font-karla');
  if (line.startsWith('# ')) return makeHeader(line.slice(2), 'h2', 'font-bold text-tan-900 mt-3 mb-1 font-karla');

  if (/^[-*]\s/.test(line)) {
    const div = document.createElement('div');
    div.className = 'flex gap-2 text-tan-700 text-[13px] font-karla leading-relaxed';
    const bullet = document.createElement('span');
    bullet.className = 'text-tan-400 shrink-0 mt-0.5';
    bullet.textContent = '\u2022';
    const content = document.createElement('span');
    renderInlineInto(content, line.slice(2));
    div.appendChild(bullet);
    div.appendChild(content);
    return div;
  }

  const numMatch = line.match(/^(\d+)\.\s/);
  if (numMatch) {
    const div = document.createElement('div');
    div.className = 'flex gap-2 text-tan-700 text-[13px] font-karla leading-relaxed';
    const num = document.createElement('span');
    num.className = 'text-tan-400 shrink-0 mt-0.5 min-w-[16px]';
    num.textContent = numMatch[1] + '.';
    const content = document.createElement('span');
    renderInlineInto(content, line.slice(numMatch[0].length));
    div.appendChild(num);
    div.appendChild(content);
    return div;
  }

  const p = document.createElement('p');
  p.className = 'text-tan-700 text-[13px] font-karla leading-relaxed';
  renderInlineInto(p, line);
  return p;
}

function makeHeader(text: string, tag: string, className: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
  return el;
}

// ── Inline rendering (bold, italic, code, links) ────────────────────────────

const INLINE_PATTERNS: [RegExp, (match: RegExpMatchArray) => HTMLElement][] = [
  [/`([^`]+)`/, (m) => {
    const el = document.createElement('code');
    el.className = 'bg-tan-100 text-tan-800 px-1 py-0.5 rounded text-xs font-mono';
    el.textContent = m[1];
    return el;
  }],
  [/\[([^\]]+)\]\(([^)]+)\)/, (m) => {
    const a = document.createElement('a');
    a.href = m[2];
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'text-tan-600 underline hover:text-tan-800';
    a.textContent = m[1];
    return a;
  }],
  [/\*\*(.+?)\*\*/, (m) => {
    const el = document.createElement('strong');
    el.className = 'font-semibold text-tan-900';
    el.textContent = m[1];
    return el;
  }],
  [/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/, (m) => {
    const el = document.createElement('em');
    el.className = 'italic text-tan-700';
    el.textContent = m[1];
    return el;
  }],
];

function renderInlineInto(container: HTMLElement, text: string) {
  let remaining = text;

  while (remaining.length > 0) {
    let best: { index: number; match: RegExpMatchArray; factory: (m: RegExpMatchArray) => HTMLElement } | null = null;

    for (const [re, factory] of INLINE_PATTERNS) {
      const m = remaining.match(re);
      if (m && m.index !== undefined && (!best || m.index < best.index)) {
        best = { index: m.index, match: m, factory };
      }
    }

    if (!best) {
      container.appendChild(document.createTextNode(remaining));
      break;
    }

    if (best.index > 0) {
      container.appendChild(document.createTextNode(remaining.substring(0, best.index)));
    }

    container.appendChild(best.factory(best.match));
    remaining = remaining.substring(best.index + best.match[0].length);
  }
}
