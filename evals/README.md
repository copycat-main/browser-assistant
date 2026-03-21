# CopyCat Router Eval

Evaluation framework for testing the intent classification router — the component that decides whether a user prompt should be handled as `chat`, `extract`, `research`, or `automate`.

## Setup

```bash
cd evals
npm install
```

## How to Run

```bash
# Fast patterns only (instant, no API key needed)
npm run eval:fast

# AI classifier only (needs ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY=your-key npm run eval:ai

# Full comparison: fast vs AI vs production pipeline (fast→AI fallback)
ANTHROPIC_API_KEY=your-key npm run eval:both

# Show all failures instead of first 10
npm run eval:verbose
```

### Filtering

```bash
# By difficulty
npx tsx run.ts --difficulty=hard --verbose

# By category
npx tsx run.ts --category=temporal-ambiguity

# Combined
npx tsx run.ts --classifier=fast --difficulty=easy --verbose
```

### Saving Results

```bash
npx tsx run.ts --output=results/run-001.json
```

Results are saved as JSON with full per-case details, metrics, and confusion matrices. The `results/` directory is gitignored.

## Dataset

The eval dataset lives in `datasets/classification_v1.jsonl`. Each line is a JSON object:

```json
{
  "id": "eval-001",
  "input": "Write me a tweet about sustainable energy",
  "expected_mode": "chat",
  "acceptable_modes": ["chat"],
  "difficulty": "easy",
  "category": "content-generation",
  "ambiguity": "none",
  "rationale": "Content generation — user wants text output, not browser action",
  "tags": ["content", "social-media"]
}
```

### Fields

| Field | Description |
|-------|-------------|
| `expected_mode` | The ground truth classification |
| `acceptable_modes` | For ambiguous cases, multiple modes are acceptable |
| `difficulty` | `easy`, `medium`, `hard` |
| `ambiguity` | `none`, `low`, `high` — marks genuinely debatable cases |
| `rationale` | Human-written explanation of why this label is correct |

### Editing the Dataset

Open `classification_v1.jsonl`, review each case, and change `expected_mode` / `acceptable_modes` if you disagree with the label. Then re-run the eval to see how metrics change.

## Metrics

- **Accuracy (lenient)** — predicted mode is in `acceptable_modes`
- **Accuracy (strict)** — predicted mode exactly matches `expected_mode`
- **Macro F1** — mean of per-class F1 scores (headline metric)
- **Coverage** — % of cases where the classifier returned a prediction (vs null)
- **Per-class precision/recall/F1** — identifies which modes are strongest/weakest
- **Confusion matrix** — shows exactly where misclassifications happen
- **Stratified metrics** — broken down by difficulty and category

## Workflow

1. Run `npm run eval:fast` to test regex patterns (instant)
2. Fix patterns in `src/services/router.ts`
3. Mirror changes in `evals/src/classifiers/fast-patterns.ts`
4. Re-run and check if metrics improved
5. Run `npm run eval:both` to compare fast vs AI vs pipeline
6. Add new test cases as you discover real-world failures
