#!/usr/bin/env tsx
/**
 * CopyCat Router Eval — CLI Entry Point
 *
 * Usage:
 *   npx tsx run.ts [options]
 *
 * Options:
 *   --classifier=fast|ai|both   Classifier to evaluate (default: both)
 *   --dataset=<path>            Dataset file (default: datasets/classification_v1.jsonl)
 *   --output=<path>             Save results JSON to file
 *   --category=<name>           Filter by category
 *   --difficulty=easy|medium|hard  Filter by difficulty
 *   --verbose                   Show all failures (default: first 10)
 *   --concurrency=<n>           AI classifier concurrency (default: 5)
 *
 * Environment:
 *   ANTHROPIC_API_KEY           Required for --classifier=ai or --classifier=both
 *
 * Examples:
 *   npx tsx run.ts --classifier=fast                          # Test regex patterns only
 *   npx tsx run.ts --classifier=ai --verbose                  # Test AI classifier, show all failures
 *   npx tsx run.ts --classifier=both --output=results/run.json  # Full comparison, save results
 *   npx tsx run.ts --difficulty=hard --verbose                # Focus on hard cases
 *   npx tsx run.ts --category=temporal-ambiguity              # Test temporal edge cases
 */

import { runEval } from './src/runner.js';
import type { CLIOptions } from './src/types.js';

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);

  const opts: CLIOptions = {
    classifier: 'both',
    dataset: 'datasets/classification_v1.jsonl',
    verbose: false,
    concurrency: 5,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    if (arg === '--verbose' || arg === '-v') {
      opts.verbose = true;
      continue;
    }

    const [key, value] = arg.split('=');
    switch (key) {
      case '--classifier':
        if (!['fast', 'ai', 'both'].includes(value)) {
          console.error(`Invalid classifier: ${value}. Must be fast, ai, or both.`);
          process.exit(1);
        }
        opts.classifier = value as 'fast' | 'ai' | 'both';
        break;
      case '--dataset':
        opts.dataset = value;
        break;
      case '--output':
        opts.output = value;
        break;
      case '--category':
        opts.category = value;
        break;
      case '--difficulty':
        if (!['easy', 'medium', 'hard'].includes(value)) {
          console.error(`Invalid difficulty: ${value}. Must be easy, medium, or hard.`);
          process.exit(1);
        }
        opts.difficulty = value as 'easy' | 'medium' | 'hard';
        break;
      case '--concurrency':
        opts.concurrency = parseInt(value, 10);
        if (isNaN(opts.concurrency) || opts.concurrency < 1) {
          console.error('Concurrency must be a positive integer.');
          process.exit(1);
        }
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        printUsage();
        process.exit(1);
    }
  }

  return opts;
}

function printUsage(): void {
  console.log(`
  CopyCat Router Eval

  Usage: npx tsx run.ts [options]

  Options:
    --classifier=fast|ai|both   Classifier to evaluate (default: both)
    --dataset=<path>            Dataset file (default: datasets/classification_v1.jsonl)
    --output=<path>             Save results JSON to file
    --category=<name>           Filter cases by category
    --difficulty=easy|medium|hard  Filter cases by difficulty
    --verbose, -v               Show all failures (default: first 10)
    --concurrency=<n>           AI classifier concurrency (default: 5)
    --help, -h                  Show this help

  Environment:
    ANTHROPIC_API_KEY           Required for ai and both classifiers

  Examples:
    npx tsx run.ts --classifier=fast
    npx tsx run.ts --classifier=ai --verbose
    npx tsx run.ts --difficulty=hard --verbose
    npx tsx run.ts --category=temporal-ambiguity
    npx tsx run.ts --output=results/run-$(date +%Y%m%d).json
  `);
}

// ---------- Run ----------

const opts = parseArgs();
runEval(opts).catch((err) => {
  console.error('\n  Fatal error:', err.message);
  process.exit(1);
});
