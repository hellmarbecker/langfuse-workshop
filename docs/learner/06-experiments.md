# 06 Experiments

## Starting point

You have a seeded Langfuse dataset and a production-instrumented app.

## Goal

Run the same app logic on the dataset and attach at least one evaluator so runs can be compared.

## What you need to do

1. Load the dataset from Langfuse.
2. Reuse the same `runSupportConversation(...)` function from the web app.
3. Use `dataset.runExperiment(...)` to create a dataset run.
4. Add one evaluator.
5. Include useful run metadata such as model and prompt variant.

## Files you are expected to change

- `scripts/run-dataset.ts`

## How to verify you are done

- Running `npm run dataset:run` creates a dataset run in Langfuse.
- Item outputs are visible in the Langfuse UI.
- At least one score is attached to each run item.

## End state

This finished experiment workflow becomes the starting point for `07-prompt-iteration`.
