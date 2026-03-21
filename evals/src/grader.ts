/**
 * Grading engine: computes all metrics from eval results.
 *
 * Metrics computed:
 * - Accuracy (lenient: predicted in acceptable_modes)
 * - Strict accuracy (predicted === expected_mode)
 * - Coverage (% of cases where classifier returned non-null)
 * - Per-class precision, recall, F1
 * - Macro F1 (mean of per-class F1, headline metric)
 * - Confusion matrix
 * - Stratified accuracy by difficulty and category
 */

import {
  ALL_MODES,
  type TaskMode,
  type EvalResult,
  type EvalMetrics,
  type ClassMetrics,
  type ConfusionMatrix,
  type StratifiedMetric,
} from './types.js';

export function gradeResults(results: EvalResult[]): EvalMetrics {
  return {
    accuracy: computeAccuracy(results, 'lenient'),
    strict_accuracy: computeAccuracy(results, 'strict'),
    macro_f1: computeMacroF1(results),
    coverage: computeCoverage(results),
    per_class: computePerClassMetrics(results),
    confusion_matrix: buildConfusionMatrix(results),
    by_difficulty: stratifyBy(results, (r) => {
      const c = findCase(r);
      return c?.difficulty ?? 'unknown';
    }),
    by_category: stratifyBy(results, (r) => {
      const c = findCase(r);
      return c?.category ?? 'unknown';
    }),
  };
}

// We store cases externally so the grader can stratify by metadata
let _caseMap: Map<string, { difficulty: string; category: string }> = new Map();

export function setCaseMetadata(
  cases: Array<{ id: string; difficulty: string; category: string }>,
): void {
  _caseMap = new Map(cases.map((c) => [c.id, { difficulty: c.difficulty, category: c.category }]));
}

function findCase(r: EvalResult) {
  return _caseMap.get(r.case_id);
}

// ---------- Accuracy ----------

function computeAccuracy(results: EvalResult[], mode: 'lenient' | 'strict'): number {
  const evaluated = results.filter((r) => r.predicted_mode !== null);
  if (evaluated.length === 0) return 0;
  const passed = evaluated.filter((r) => (mode === 'lenient' ? r.pass : r.strict_pass));
  return passed.length / evaluated.length;
}

function computeCoverage(results: EvalResult[]): number {
  if (results.length === 0) return 0;
  const covered = results.filter((r) => r.predicted_mode !== null);
  return covered.length / results.length;
}

// ---------- Per-class Precision / Recall / F1 ----------

function computePerClassMetrics(results: EvalResult[]): Record<TaskMode, ClassMetrics> {
  const evaluated = results.filter((r) => r.predicted_mode !== null);
  const metrics: Record<string, ClassMetrics> = {};

  for (const mode of ALL_MODES) {
    const tp = evaluated.filter(
      (r) => r.predicted_mode === mode && r.expected_mode === mode,
    ).length;
    const fp = evaluated.filter(
      (r) => r.predicted_mode === mode && r.expected_mode !== mode,
    ).length;
    const fn = evaluated.filter(
      (r) => r.predicted_mode !== mode && r.expected_mode === mode,
    ).length;
    const support = results.filter((r) => r.expected_mode === mode).length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    metrics[mode] = { precision, recall, f1, support };
  }

  return metrics as Record<TaskMode, ClassMetrics>;
}

function computeMacroF1(results: EvalResult[]): number {
  const perClass = computePerClassMetrics(results);
  const modes = ALL_MODES.filter((m) => perClass[m].support > 0);
  if (modes.length === 0) return 0;
  const sum = modes.reduce((acc, m) => acc + perClass[m].f1, 0);
  return sum / modes.length;
}

// ---------- Confusion Matrix ----------

function buildConfusionMatrix(results: EvalResult[]): ConfusionMatrix {
  const labels: (TaskMode | 'null')[] = [...ALL_MODES, 'null'];
  const matrix: Record<TaskMode, Record<TaskMode | 'null', number>> = {} as any;

  for (const actual of ALL_MODES) {
    matrix[actual] = {} as Record<TaskMode | 'null', number>;
    for (const predicted of labels) {
      matrix[actual][predicted] = 0;
    }
  }

  for (const r of results) {
    const actual = r.expected_mode;
    const predicted: TaskMode | 'null' = r.predicted_mode ?? 'null';
    if (matrix[actual]) {
      matrix[actual][predicted]++;
    }
  }

  return { matrix, labels };
}

// ---------- Stratified Metrics ----------

function stratifyBy(
  results: EvalResult[],
  keyFn: (r: EvalResult) => string,
): Record<string, StratifiedMetric> {
  const groups: Record<string, EvalResult[]> = {};

  for (const r of results) {
    const key = keyFn(r);
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  const metrics: Record<string, StratifiedMetric> = {};
  for (const [key, group] of Object.entries(groups)) {
    const evaluated = group.filter((r) => r.predicted_mode !== null);
    const passed = evaluated.filter((r) => r.pass);
    const strictPassed = evaluated.filter((r) => r.strict_pass);

    metrics[key] = {
      accuracy: evaluated.length > 0 ? passed.length / evaluated.length : 0,
      strict_accuracy: evaluated.length > 0 ? strictPassed.length / evaluated.length : 0,
      total: group.length,
      passed: passed.length,
    };
  }

  return metrics;
}
