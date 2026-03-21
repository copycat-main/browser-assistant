/**
 * Fast regex-based intent classifier.
 * Mirrors the exact patterns from src/services/router.ts
 *
 * Priority order: extract > automate > research > chat
 * Returns null if no pattern matches (would fall through to AI in production)
 */

import type { TaskMode } from '../types.js';

const EXTRACT_PATTERNS = [
  /^(extract|get|pull|grab|scrape|list|show me|give me)\s+(the |all (the |of the )?|every |each )?(data|info|information|prices?|emails?|names?|links?|text|content|numbers?|details?|items?|products?|table|contacts?|ratings?|reviews?)/i,
  /^(summarize|sum up|tldr|overview of)\s+(this|the)\s+(page|article|post|site)/i,
];

const AUTOMATE_PATTERNS = [
  /^(click|tap|press)\s/i,
  /^fill\s+(in|out|this)\s/i,
  /^complete\s+(this|the)\s+(form|application|registration)/i,
  /^(go\s+to|navigate\s+to|open|visit)\s/i,
  /^(submit|send)\s+(this|the|a)\s/i,
  /^scroll\s+(up|down|to)\b/i,
  /^(sign\s+up|sign\s+in|log\s+in|log\s+out|login|logout)\b/i,
  /^(download|upload)\s/i,
  /^(like|share|bookmark|save|follow)\s+(this|that|the)\s/i,
  /^add\s+.+\s+to\s+(my\s+|the\s+)?(cart|bag|wishlist)\b/i,
  /^post\s+this\s/i,
];

const RESEARCH_PATTERNS = [
  /^(research|look up|find( out| me| the| a)?|investigate|compare|what are the best|look into)\s/i,
  /^(search|search for|look for)\s+(?!.+\s+on\s+\w+)/i,
  /^do\s+(deep\s+|some\s+|quick\s+)?research\s/i,
  /\b(latest|current(ly)?|trending|right now|today|tonight|this (week|weekend|month|year)|breaking|recent|newest|up[- ]to[- ]date)\b/i,
  /\b(weather|forecast|stock price|current price)\b/i,
];

const CHAT_PATTERNS = [
  /^(what|who|why|how|when|where|which|is|are|was|were|do|does|did|can|could|would|should|tell me|explain|describe)\s/i,
  /\?$/,
  /^(write|draft|compose|create|generate|make)\s+(me\s+)?(a\s+|an\s+)?(\w+\s+)?(tweet|post|email|message|letter|essay|paragraph|summary|text|response|reply|bio|caption|headline|title|tagline|slogan|script|outline|article|blog|report|review|description|pitch|proposal|story|poem|song|joke|function|class|program|app|component|test|code)/i,
  /^(translate|convert|calculate|compute|proofread|edit|fix|rewrite|paraphrase|simplify|summarize)\s/i,
];

export function classifyFast(input: string): TaskMode | null {
  const trimmed = input.trim();

  for (const pattern of EXTRACT_PATTERNS) {
    if (pattern.test(trimmed)) return 'extract';
  }
  for (const pattern of AUTOMATE_PATTERNS) {
    if (pattern.test(trimmed)) return 'automate';
  }
  for (const pattern of RESEARCH_PATTERNS) {
    if (pattern.test(trimmed)) return 'research';
  }
  for (const pattern of CHAT_PATTERNS) {
    if (pattern.test(trimmed)) return 'chat';
  }

  return null;
}
