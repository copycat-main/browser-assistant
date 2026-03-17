import React, { useEffect } from 'react';
import { useAgentStore } from '../store/agentStore';
import { PageContext } from '../../types/agent';

interface Props {
  onSelectPrompt: (prompt: string) => void;
}

function getExampleQueries(pageContext: PageContext | null): string[] {
  if (!pageContext?.domain) {
    return [
      'What can you help me with?',
      'Summarize this page',
      'Open YouTube',
      'Research the latest tech news',
    ];
  }

  const domain = pageContext.domain.toLowerCase();

  if (domain.includes('amazon')) {
    return [
      'Extract all product prices on this page',
      'Summarize the reviews',
      'Compare these products',
      'Find me a better deal on this item',
    ];
  }
  if (domain.includes('github')) {
    return [
      'Summarize this repository',
      'Explain this code',
      'What are the open issues about?',
      'Extract the contributors list',
    ];
  }
  if (domain.includes('youtube')) {
    return [
      'What is this video about?',
      'Summarize the comments',
      'Search for React tutorials',
      'Extract the video description',
    ];
  }
  if (domain.includes('linkedin')) {
    return [
      'Summarize this profile',
      'Extract work experience',
      'Fill out my job application',
      'Search for product manager roles',
    ];
  }
  if (domain.includes('google') && pageContext.url.includes('/search')) {
    return [
      'Summarize these search results',
      'Research this topic in depth',
      'Open the first result',
      'Extract all the links',
    ];
  }
  if (domain.includes('twitter') || domain.includes('x.com')) {
    return [
      'Summarize this thread',
      'What are people saying about this?',
      'Extract the main points',
      'Research this topic more',
    ];
  }
  if (domain.includes('reddit')) {
    return [
      'Summarize this discussion',
      'What is the consensus here?',
      'Extract the top comments',
      'Research this topic further',
    ];
  }
  if (domain.includes('wikipedia')) {
    return [
      'Give me a quick summary',
      'Extract the key facts',
      'Explain this in simpler terms',
      'Research related topics',
    ];
  }

  // Generic examples using page context
  return [
    `Summarize this page`,
    `Extract the key information`,
    `What is ${pageContext.title?.substring(0, 30) || 'this page'} about?`,
    `Research more about this topic`,
  ];
}

export default function LandingPage({ onSelectPrompt }: Props) {
  const pageContext = useAgentStore((s) => s.pageContext);
  const setPageContext = useAgentStore((s) => s.setPageContext);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTEXT' }).then((ctx) => {
      if (ctx) setPageContext(ctx);
    }).catch(() => {});
  }, [setPageContext]);

  const examples = getExampleQueries(pageContext);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
      {/* Logo and site context */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <img
            src="/icons/icon-128.png"
            alt="CopyCat"
            className="w-12 h-12 opacity-60"
          />
          {pageContext?.favicon && (
            <>
              <span className="text-tan-300 text-lg">+</span>
              <img
                src={pageContext.favicon}
                alt=""
                className="w-8 h-8 rounded-md"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </>
          )}
        </div>
        {pageContext?.domain ? (
          <p className="text-sm text-tan-500 font-karla">
            Ready to help on <span className="font-semibold text-tan-700">{pageContext.domain}</span>
          </p>
        ) : (
          <p className="text-sm text-tan-500 font-karla">
            Your browser sidekick — ask anything
          </p>
        )}
      </div>

      {/* Example queries */}
      <div className="w-full space-y-2">
        <p className="text-xs text-tan-400 font-karla text-center uppercase tracking-wider">
          Try asking
        </p>
        <div className="space-y-1.5">
          {examples.map((example, i) => (
            <button
              key={i}
              onClick={() => onSelectPrompt(example)}
              className="w-full text-left px-3 py-2.5 rounded-xl border border-tan-200 bg-white
                         hover:bg-tan-100 hover:border-tan-300 transition-all text-sm text-tan-700
                         font-karla group"
            >
              <span className="text-tan-400 group-hover:text-tan-600 mr-2">→</span>
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
