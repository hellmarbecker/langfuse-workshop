# 06 Experiments

## How to think about this step

Now we stop looking at single traces and start looking at repeated behavior on the same task set. This is where the AI engineering loop starts to feel systematic.

## Goal

Run the app against the Langfuse dataset and attach one simple evaluator so results can be compared across runs.

## What this repo does

- Loads the hosted Langfuse dataset
- Runs the same `runSupportConversation(...)` app logic used by the web chat
- Uses `dataset.runExperiment(...)`
- Adds a simple `keyword_overlap` evaluator

## Files to point at

- `scripts/run-dataset.ts`
- `src/server/support-agent.ts`

## Run command

```bash
npm run dataset:run
```

## What to inspect in Langfuse

- the dataset run table
- item-level outputs
- the `keyword_overlap` score
- traces linked to each item result

## Teaching point

Experiments are not a separate app. They are the same application logic run repeatedly on a scoped dataset so we can compare behavior over time.
