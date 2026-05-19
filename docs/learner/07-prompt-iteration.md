# 07 Prompt Iteration

## Starting point

You can already run dataset experiments on the current prompt.

## Goal

Make one prompt change and compare the new run to the previous run.

## What you need to do

1. Change the prompt in Langfuse or switch to another prompt variant.
2. Run the same dataset again.
3. Compare the two runs side by side in Langfuse.
4. Look for both improvements and regressions.

## Files you are expected to change

- usually the prompt in Langfuse
- optionally `src/server/local-prompt.ts` if you are demonstrating a local variant

## How to verify you are done

- You have two runs on the same dataset.
- You can compare outputs item by item.
- You can explain why the prompt change helped or hurt.

## End state

You now have the full loop: trace, monitor, dataset, experiment, and iterate.
