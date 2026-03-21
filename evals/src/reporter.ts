/**
 * Console reporter with ANSI-colored output.
 * Prints headline metrics, confusion matrix, per-class breakdown,
 * stratified metrics, and individual failures.
 */

import { ALL_MODES, type TaskMode, type EvalResult, type EvalMetrics } from './types.js';

// ANSI escape codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const BG_RED = '\x1b[41m';
const BG_GREEN = '\x1b[42m';

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function f(n: number, decimals = 3): string {
  return n.toFixed(decimals);
}

function pad(s: string, width: number, align: 'left' | 'right' = 'left'): string {
  if (align === 'right') return s.padStart(width);
  return s.padEnd(width);
}

function colorScore(score: number): string {
  if (score >= 0.9) return GREEN + f(score) + RESET;
  if (score >= 0.7) return YELLOW + f(score) + RESET;
  return RED + f(score) + RESET;
}

function colorPct(score: number): string {
  if (score >= 0.9) return GREEN + pct(score) + RESET;
  if (score >= 0.7) return YELLOW + pct(score) + RESET;
  return RED + pct(score) + RESET;
}

function divider(char = '─', width = 70): string {
  return DIM + char.repeat(width) + RESET;
}

// ---------- Main Report ----------

export function printReport(
  metrics: EvalMetrics,
  results: EvalResult[],
  opts: {
    classifier: string;
    dataset: string;
    timestamp: string;
    verbose: boolean;
  },
): void {
  console.log('\n');
  printHeader(opts.classifier, opts.dataset, opts.timestamp);
  printHeadlineMetrics(metrics, results);
  printConfusionMatrix(metrics);
  printPerClassMetrics(metrics);
  printStratifiedMetrics(metrics);
  printFailures(results, opts.verbose);
  console.log('\n');
}

// ---------- Sections ----------

function printHeader(classifier: string, dataset: string, timestamp: string): void {
  console.log(divider('═'));
  console.log(
    `${BOLD}${CYAN}  COPYCAT ROUTER EVAL${RESET}  ${DIM}|${RESET}  classifier: ${BOLD}${classifier}${RESET}  ${DIM}|${RESET}  dataset: ${BOLD}${dataset}${RESET}`,
  );
  console.log(`  ${DIM}${timestamp}${RESET}`);
  console.log(divider('═'));
}

function printHeadlineMetrics(metrics: EvalMetrics, results: EvalResult[]): void {
  const total = results.length;
  const covered = results.filter((r) => r.predicted_mode !== null).length;
  const passed = results.filter((r) => r.pass && r.predicted_mode !== null).length;

  console.log(`\n${BOLD}  HEADLINE METRICS${RESET}`);
  console.log(divider());
  console.log(`  Accuracy (lenient):  ${colorPct(metrics.accuracy)}    ${DIM}(${passed}/${covered} covered cases)${RESET}`);
  console.log(`  Accuracy (strict):   ${colorPct(metrics.strict_accuracy)}`);
  console.log(`  Macro F1:            ${colorScore(metrics.macro_f1)}`);
  console.log(`  Coverage:            ${colorPct(metrics.coverage)}    ${DIM}(${covered}/${total} cases matched)${RESET}`);
  console.log(divider());
}

function printConfusionMatrix(metrics: EvalMetrics): void {
  const { matrix, labels } = metrics.confusion_matrix;
  const colWidth = 10;

  console.log(`\n${BOLD}  CONFUSION MATRIX${RESET}  ${DIM}(rows = actual, columns = predicted)${RESET}`);
  console.log(divider());

  // Header row
  let header = pad('', 12);
  for (const label of labels) {
    header += pad(label, colWidth, 'right');
  }
  console.log(`  ${DIM}${header}${RESET}`);

  // Data rows
  for (const actual of ALL_MODES) {
    let row = `  ${BOLD}${pad(actual, 12)}${RESET}`;
    for (const predicted of labels) {
      const count = matrix[actual][predicted];
      let cell: string;
      if (count === 0) {
        cell = DIM + '·' + RESET;
      } else if (actual === predicted) {
        cell = GREEN + BOLD + count.toString() + RESET;
      } else if (predicted === 'null') {
        cell = YELLOW + count.toString() + RESET;
      } else {
        cell = RED + count.toString() + RESET;
      }
      row += pad(cell, colWidth + (cell.length - cell.replace(/\x1b\[[0-9;]*m/g, '').length), 'right');
    }
    console.log(row);
  }

  console.log(divider());
}

function printPerClassMetrics(metrics: EvalMetrics): void {
  console.log(`\n${BOLD}  PER-CLASS METRICS${RESET}`);
  console.log(divider());

  const header = `  ${pad('Class', 12)}${pad('Precision', 12)}${pad('Recall', 12)}${pad('F1', 12)}${pad('Support', 10)}`;
  console.log(`  ${DIM}${header}${RESET}`);

  for (const mode of ALL_MODES) {
    const m = metrics.per_class[mode];
    const line =
      `  ${BOLD}${pad(mode, 12)}${RESET}` +
      `${pad(colorScore(m.precision), 12 + 9)}` +  // +9 for ANSI codes
      `${pad(colorScore(m.recall), 12 + 9)}` +
      `${pad(colorScore(m.f1), 12 + 9)}` +
      `${pad(m.support.toString(), 10)}`;
    console.log(line);
  }

  console.log(divider());
}

function printStratifiedMetrics(metrics: EvalMetrics): void {
  // By difficulty
  console.log(`\n${BOLD}  BY DIFFICULTY${RESET}`);
  console.log(divider());
  for (const [level, m] of Object.entries(metrics.by_difficulty).sort()) {
    console.log(
      `  ${pad(level, 10)} ${colorPct(m.accuracy)}  ${DIM}(${m.passed}/${m.total})${RESET}`,
    );
  }
  console.log(divider());

  // By category
  console.log(`\n${BOLD}  BY CATEGORY${RESET}`);
  console.log(divider());
  const sorted = Object.entries(metrics.by_category).sort(
    ([, a], [, b]) => a.accuracy - b.accuracy,
  );
  for (const [cat, m] of sorted) {
    console.log(
      `  ${pad(cat, 24)} ${colorPct(m.accuracy)}  ${DIM}(${m.passed}/${m.total})${RESET}`,
    );
  }
  console.log(divider());
}

function printFailures(results: EvalResult[], verbose: boolean): void {
  const failures = results.filter((r) => !r.pass || r.predicted_mode === null);

  if (failures.length === 0) {
    console.log(`\n  ${BG_GREEN}${WHITE}${BOLD} ALL CASES PASSED ${RESET}`);
    return;
  }

  console.log(`\n${BOLD}  FAILURES${RESET}  ${BG_RED}${WHITE} ${failures.length} ${RESET}`);
  console.log(divider());

  const toShow = verbose ? failures : failures.slice(0, 10);

  for (const r of toShow) {
    const predicted = r.predicted_mode ?? 'null';
    const icon = r.predicted_mode === null ? YELLOW + '○' + RESET : RED + '✗' + RESET;
    console.log(
      `  ${icon} ${BOLD}${r.case_id}${RESET}: expected ${GREEN}${r.expected_mode}${RESET}, got ${RED}${predicted}${RESET}`,
    );
    console.log(`    ${DIM}Input: "${r.input.substring(0, 80)}${r.input.length > 80 ? '...' : ''}"${RESET}`);
    if (r.acceptable_modes.length > 1) {
      console.log(`    ${DIM}Acceptable: [${r.acceptable_modes.join(', ')}]${RESET}`);
    }
  }

  if (!verbose && failures.length > 10) {
    console.log(`\n  ${DIM}... and ${failures.length - 10} more. Use --verbose to see all.${RESET}`);
  }

  console.log(divider());
}

// ---------- Comparison Report (for --classifier=both) ----------

export function printComparisonReport(
  fastMetrics: EvalMetrics,
  aiMetrics: EvalMetrics,
  pipelineMetrics: EvalMetrics,
): void {
  console.log(`\n${BOLD}${CYAN}  CLASSIFIER COMPARISON${RESET}`);
  console.log(divider('═'));

  const header = `  ${pad('Metric', 22)}${pad('Fast Patterns', 16)}${pad('AI (Haiku)', 16)}${pad('Pipeline', 16)}`;
  console.log(`  ${DIM}${header}${RESET}`);

  const rows: [string, number, number, number][] = [
    ['Accuracy', fastMetrics.accuracy, aiMetrics.accuracy, pipelineMetrics.accuracy],
    ['Strict Accuracy', fastMetrics.strict_accuracy, aiMetrics.strict_accuracy, pipelineMetrics.strict_accuracy],
    ['Macro F1', fastMetrics.macro_f1, aiMetrics.macro_f1, pipelineMetrics.macro_f1],
    ['Coverage', fastMetrics.coverage, aiMetrics.coverage, pipelineMetrics.coverage],
  ];

  for (const [label, fast, ai, pipeline] of rows) {
    const isF1 = label === 'Macro F1';
    const fmt = isF1 ? colorScore : colorPct;
    const ansiPad = 9; // ANSI escape code length
    console.log(
      `  ${pad(label, 22)}${pad(fmt(fast), 16 + ansiPad)}${pad(fmt(ai), 16 + ansiPad)}${pad(fmt(pipeline), 16 + ansiPad)}`,
    );
  }

  console.log(divider('═'));

  // Per-class comparison
  console.log(`\n${BOLD}  F1 BY CLASS${RESET}`);
  console.log(divider());
  const classHeader = `  ${pad('Class', 12)}${pad('Fast', 12)}${pad('AI', 12)}${pad('Pipeline', 12)}`;
  console.log(`  ${DIM}${classHeader}${RESET}`);

  for (const mode of ALL_MODES) {
    const ansiPad = 9;
    console.log(
      `  ${BOLD}${pad(mode, 12)}${RESET}` +
      `${pad(colorScore(fastMetrics.per_class[mode].f1), 12 + ansiPad)}` +
      `${pad(colorScore(aiMetrics.per_class[mode].f1), 12 + ansiPad)}` +
      `${pad(colorScore(pipelineMetrics.per_class[mode].f1), 12 + ansiPad)}`,
    );
  }
  console.log(divider());
}
