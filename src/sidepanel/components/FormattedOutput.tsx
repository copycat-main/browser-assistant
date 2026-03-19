import React from 'react';

interface Props {
  content: string;
}

export default function FormattedOutput({ content }: Props) {
  // Detect if content is JSON
  const trimmed = content.trim();
  if (
    (trimmed.startsWith('{') || trimmed.startsWith('[')) &&
    (trimmed.endsWith('}') || trimmed.endsWith(']'))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      return (
        <pre
          className="bg-tan-100 border border-tan-200 rounded-lg p-3 text-xs font-mono
                        overflow-x-auto whitespace-pre-wrap text-tan-800"
        >
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      // Not valid JSON, fall through
    }
  }

  return <div>{renderMarkdown(content)}</div>;
}

// Strip markdown artifacts so the text reads clean
function cleanInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1') // *italic* → italic
    .replace(/__(.+?)__/g, '$1') // __bold__ → bold
    .replace(/_(.+?)_/g, '$1'); // _italic_ → italic
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let codeKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${codeKey++}`}
            className="bg-tan-100 border border-tan-200 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-tan-800 my-2"
          >
            {codeContent.trim()}
          </pre>,
        );
        codeContent = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + '\n';
      continue;
    }

    // Headers — strip markdown markers, show as clean styled text
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="font-semibold text-tan-900 mt-3 mb-1 text-sm font-karla">
          {cleanInline(line.slice(4))}
        </h4>,
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="font-bold text-tan-900 mt-3 mb-1 text-sm font-karla">
          {cleanInline(line.slice(3))}
        </h3>,
      );
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={i} className="font-bold text-tan-900 mt-3 mb-1 font-karla">
          {cleanInline(line.slice(2))}
        </h2>,
      );
      continue;
    }

    // Bullet points
    if (line.match(/^[-*]\s/)) {
      elements.push(
        <div key={i} className="flex gap-2 text-tan-700 text-[13px] font-karla leading-relaxed">
          <span className="text-tan-400 shrink-0 mt-0.5">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>,
      );
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s/);
    if (numMatch) {
      elements.push(
        <div key={i} className="flex gap-2 text-tan-700 text-[13px] font-karla leading-relaxed">
          <span className="text-tan-400 shrink-0 mt-0.5 min-w-[16px]">{numMatch[1]}.</span>
          <span>{renderInline(line.slice(numMatch[0].length))}</span>
        </div>,
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-tan-700 text-[13px] font-karla leading-relaxed">
        {renderInline(line)}
      </p>,
    );
  }

  // Close unclosed code block
  if (inCodeBlock && codeContent) {
    elements.push(
      <pre
        key={`code-${codeKey}`}
        className="bg-tan-100 border border-tan-200 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-tan-800 my-2"
      >
        {codeContent.trim()}
      </pre>,
    );
  }

  return elements;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code (keep these styled)
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Link
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    let earliest: { type: string; index: number; match: RegExpMatchArray } | null = null;

    if (codeMatch && codeMatch.index !== undefined) {
      earliest = { type: 'code', index: codeMatch.index, match: codeMatch };
    }
    if (
      linkMatch &&
      linkMatch.index !== undefined &&
      (!earliest || linkMatch.index < earliest.index)
    ) {
      earliest = { type: 'link', index: linkMatch.index, match: linkMatch };
    }

    if (!earliest) {
      // Clean remaining text of bold/italic markers
      parts.push(cleanInline(remaining));
      break;
    }

    // Add cleaned text before match
    if (earliest.index > 0) {
      parts.push(cleanInline(remaining.substring(0, earliest.index)));
    }

    if (earliest.type === 'code') {
      parts.push(
        <code key={key++} className="bg-tan-100 text-tan-800 px-1 py-0.5 rounded text-xs font-mono">
          {earliest.match[1]}
        </code>,
      );
    } else if (earliest.type === 'link') {
      parts.push(
        <a
          key={key++}
          href={earliest.match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-tan-600 underline hover:text-tan-800"
        >
          {cleanInline(earliest.match[1])}
        </a>,
      );
    }

    remaining = remaining.substring(earliest.index + earliest.match[0].length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
