# 07 Prompt Iteration

## How to think about this step

This is where the loop closes. We found behavior in traces, defined scope with a dataset, ran an experiment, and now we change something on purpose to see whether it improves results.

## Goal

Make one prompt change, rerun the same dataset, and compare the results side by side.

## Suggested workshop move

- Publish a second prompt variant or update the Langfuse prompt
- Change `WORKSHOP_PROMPT_VARIANT` or the Langfuse-managed prompt content
- Run the dataset again
- Compare both runs in Langfuse

## What to inspect

- qualitative differences in individual answers
- `keyword_overlap` changes across runs
- which items improved
- which items regressed

## Teaching point

This step makes “evaluation” click for many people. The value is not the single score by itself. The value is that one change can now be inspected, compared, and discussed systematically.
