/**
 * Eval runner: loads dataset, runs classifiers, grades, reports.
 *
 * Supports three modes:
 * - fast:     Only the regex-based fast classifier
 * - ai:       Only the Anthropic API classifier (Haiku)
 * - both:     Runs both independently + the production pipeline (fast → AI fallback)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';
import { classifyFast } from './classifiers/fast-patterns.js';
import { classifyAI } from './classifiers/ai-classifier.js';
import { gradeResults, setCaseMetadata } from './grader.js';
import { printReport, printComparisonReport } from './reporter.js';
import type { EvalCase, EvalResult, EvalRunSummary, CLIOptions, TaskMode } from './types.js';

// ---------- Dataset Loading ----------

function loadDataset(path: string): EvalCase[] {
  const abs = resolve(path);
  const raw = readFileSync(abs, 'utf-8');
  return raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line, i) => {
      try {
        return JSON.parse(line) as EvalCase;
      } catch {
        throw new Error(`Invalid JSON on line ${i + 1} of ${path}`);
      }
    });
}

function filterCases(cases: EvalCase[], opts: CLIOptions): EvalCase[] {
  let filtered = cases;
  if (opts.category) {
    filtered = filtered.filter((c) => c.category === opts.category);
  }
  if (opts.difficulty) {
    filtered = filtered.filter((c) => c.difficulty === opts.difficulty);
  }
  return filtered;
}

// ---------- Running Classifiers ----------

async function runFastClassifier(cases: EvalCase[]): Promise<EvalResult[]> {
  return cases.map((c) => {
    const start = performance.now();
    const predicted = classifyFast(c.input);
    const elapsed = performance.now() - start;

    return {
      case_id: c.id,
      input: c.input,
      expected_mode: c.expected_mode,
      acceptable_modes: c.acceptable_modes,
      predicted_mode: predicted,
      pass: predicted !== null && c.acceptable_modes.includes(predicted),
      strict_pass: predicted === c.expected_mode,
      classifier: 'fast' as const,
      latency_ms: elapsed,
    };
  });
}

async function runAIClassifier(
  cases: EvalCase[],
  concurrency: number,
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  const total = cases.length;
  let completed = 0;

  // Process in batches for concurrency control
  for (let i = 0; i < cases.length; i += concurrency) {
    const batch = cases.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (c) => {
        const pageCtx = c.page_context ?? { url: 'https://example.com', title: 'Example Page' };
        const start = performance.now();

        try {
          const predicted = await classifyAI(c.input, pageCtx);
          const elapsed = performance.now() - start;

          completed++;
          process.stdout.write(`\r  Classifying... ${completed}/${total}`);

          return {
            case_id: c.id,
            input: c.input,
            expected_mode: c.expected_mode,
            acceptable_modes: c.acceptable_modes,
            predicted_mode: predicted,
            pass: c.acceptable_modes.includes(predicted),
            strict_pass: predicted === c.expected_mode,
            classifier: 'ai' as const,
            latency_ms: elapsed,
          } satisfies EvalResult;
        } catch (err) {
          completed++;
          process.stdout.write(`\r  Classifying... ${completed}/${total}`);

          return {
            case_id: c.id,
            input: c.input,
            expected_mode: c.expected_mode,
            acceptable_modes: c.acceptable_modes,
            predicted_mode: null,
            pass: false,
            strict_pass: false,
            classifier: 'ai' as const,
            latency_ms: performance.now() - start,
          } satisfies EvalResult;
        }
      }),
    );
    results.push(...batchResults);
  }

  process.stdout.write('\r' + ' '.repeat(40) + '\r'); // clear progress line
  return results;
}

function runPipeline(
  fastResults: EvalResult[],
  aiResults: EvalResult[],
  cases: EvalCase[],
): EvalResult[] {
  return cases.map((c) => {
    const fast = fastResults.find((r) => r.case_id === c.id)!;
    const ai = aiResults.find((r) => r.case_id === c.id)!;

    // Production behavior: use fast if it returns non-null, else AI
    const predicted: TaskMode | null = fast.predicted_mode ?? ai.predicted_mode;

    return {
      case_id: c.id,
      input: c.input,
      expected_mode: c.expected_mode,
      acceptable_modes: c.acceptable_modes,
      predicted_mode: predicted,
      pass: predicted !== null && c.acceptable_modes.includes(predicted),
      strict_pass: predicted === c.expected_mode,
      classifier: 'pipeline' as const,
      latency_ms: fast.latency_ms + (fast.predicted_mode === null ? ai.latency_ms : 0),
    };
  });
}

// ---------- Output ----------

function saveResults(summary: EvalRunSummary, outputPath: string): void {
  const abs = resolve(outputPath);
  mkdirSync(resolve(abs, '..'), { recursive: true });
  writeFileSync(abs, JSON.stringify(summary, null, 2));
  console.log(`\n  Results saved to ${abs}`);
}

// ---------- Main ----------

export async function runEval(opts: CLIOptions): Promise<void> {
  const datasetName = basename(opts.dataset, '.jsonl');
  const timestamp = new Date().toISOString();

  // Load and filter
  console.log(`\n  Loading dataset: ${opts.dataset}`);
  const allCases = loadDataset(opts.dataset);
  const cases = filterCases(allCases, opts);
  console.log(`  Cases: ${cases.length}${cases.length !== allCases.length ? ` (filtered from ${allCases.length})` : ''}`);

  // Set case metadata for stratified metrics
  setCaseMetadata(cases.map((c) => ({ id: c.id, difficulty: c.difficulty, category: c.category })));

  if (opts.classifier === 'fast') {
    console.log(`  Classifier: fast patterns`);
    const results = await runFastClassifier(cases);
    const metrics = gradeResults(results);
    printReport(metrics, results, { classifier: 'fast', dataset: datasetName, timestamp, verbose: opts.verbose });

    if (opts.output) {
      saveResults({ timestamp, classifier: 'fast', dataset: datasetName, total_cases: cases.length, results, metrics }, opts.output);
    }
  } else if (opts.classifier === 'ai') {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('\n  Error: ANTHROPIC_API_KEY environment variable not set.');
      console.error('  Set it with: export ANTHROPIC_API_KEY=your-key\n');
      process.exit(1);
    }
    console.log(`  Classifier: AI (Haiku)`);
    const results = await runAIClassifier(cases, opts.concurrency);
    const metrics = gradeResults(results);
    printReport(metrics, results, { classifier: 'ai', dataset: datasetName, timestamp, verbose: opts.verbose });

    if (opts.output) {
      saveResults({ timestamp, classifier: 'ai', dataset: datasetName, total_cases: cases.length, results, metrics }, opts.output);
    }
  } else {
    // both: run all three (fast, ai, pipeline)
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('\n  Error: ANTHROPIC_API_KEY environment variable not set.');
      console.error('  Set it with: export ANTHROPIC_API_KEY=your-key\n');
      process.exit(1);
    }

    console.log(`  Classifier: both (fast + AI + pipeline)`);

    // Run fast
    console.log(`\n  Running fast patterns...`);
    const fastResults = await runFastClassifier(cases);
    const fastMetrics = gradeResults(fastResults);

    // Run AI
    console.log(`  Running AI classifier...`);
    const aiResults = await runAIClassifier(cases, opts.concurrency);
    const aiMetrics = gradeResults(aiResults);

    // Run pipeline (fast → AI fallback)
    const pipelineResults = runPipeline(fastResults, aiResults, cases);
    const pipelineMetrics = gradeResults(pipelineResults);

    // Print comparison
    printComparisonReport(fastMetrics, aiMetrics, pipelineMetrics);

    // Print detailed report for each
    printReport(fastMetrics, fastResults, { classifier: 'fast', dataset: datasetName, timestamp, verbose: opts.verbose });
    printReport(aiMetrics, aiResults, { classifier: 'ai', dataset: datasetName, timestamp, verbose: opts.verbose });
    printReport(pipelineMetrics, pipelineResults, { classifier: 'pipeline (fast→AI)', dataset: datasetName, timestamp, verbose: opts.verbose });

    if (opts.output) {
      saveResults(
        {
          timestamp,
          classifier: 'both',
          dataset: datasetName,
          total_cases: cases.length,
          results: pipelineResults,
          metrics: pipelineMetrics,
          fast_metrics: fastMetrics,
          ai_metrics: aiMetrics,
          pipeline_metrics: pipelineMetrics,
        },
        opts.output,
      );
    }
  }
}
