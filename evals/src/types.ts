export type TaskMode = 'chat' | 'research' | 'extract' | 'automate';

export const ALL_MODES: TaskMode[] = ['chat', 'extract', 'research', 'automate'];

// ---------- Dataset ----------

export interface EvalCase {
  id: string;
  input: string;
  expected_mode: TaskMode;
  acceptable_modes: TaskMode[];
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  ambiguity: 'none' | 'low' | 'high';
  rationale: string;
  tags: string[];
  page_context?: { url: string; title: string };
}

// ---------- Results ----------

export interface EvalResult {
  case_id: string;
  input: string;
  expected_mode: TaskMode;
  acceptable_modes: TaskMode[];
  predicted_mode: TaskMode | null;
  pass: boolean;           // lenient: predicted is in acceptable_modes
  strict_pass: boolean;    // strict: predicted === expected_mode
  classifier: 'fast' | 'ai' | 'pipeline';
  latency_ms: number;
}

export interface EvalRunSummary {
  timestamp: string;
  classifier: 'fast' | 'ai' | 'both';
  dataset: string;
  total_cases: number;
  results: EvalResult[];
  metrics: EvalMetrics;
  fast_metrics?: EvalMetrics;    // when classifier=both
  ai_metrics?: EvalMetrics;      // when classifier=both
  pipeline_metrics?: EvalMetrics; // fast→AI fallback
}

// ---------- Metrics ----------

export interface ClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number; // actual count of this class in ground truth
}

export interface EvalMetrics {
  accuracy: number;
  strict_accuracy: number;
  macro_f1: number;
  coverage: number; // % of cases where classifier returned non-null
  per_class: Record<TaskMode, ClassMetrics>;
  confusion_matrix: ConfusionMatrix;
  by_difficulty: Record<string, StratifiedMetric>;
  by_category: Record<string, StratifiedMetric>;
}

export interface ConfusionMatrix {
  // matrix[actual][predicted] = count
  matrix: Record<TaskMode, Record<TaskMode | 'null', number>>;
  labels: (TaskMode | 'null')[];
}

export interface StratifiedMetric {
  accuracy: number;
  strict_accuracy: number;
  total: number;
  passed: number;
}

// ---------- CLI ----------

export interface CLIOptions {
  classifier: 'fast' | 'ai' | 'both';
  dataset: string;
  output?: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  verbose: boolean;
  concurrency: number;
}
