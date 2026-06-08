---
title: "Workshop: Instructor Notes for Experiments"
description: "Facilitator notes for running Langfuse experiments, configuring platform code evaluators plus LLM-as-a-judge, and inspecting run results."
---

# 06 Experiments

Learner guide: [06 Experiments](../learner/06-experiments.md)

## Instructor notes

- The key idea is reuse: the experiment runner calls the same `runSupportConversation(...)` as the web app.
- Contrast deterministic scoring in a Langfuse code evaluator (`keyword_overlap`) with LLM-as-a-judge scoring (`correctness`).
- Confirm the default evaluator model before the Correctness setup. If learners did not configure it in session 4, send them to **Project Settings → LLM Connections** first.
- Emphasize the architecture change: the script now just creates experiment runs, and Langfuse owns both evaluation definitions.
- Keep concurrency at one for workshops so traces and console output are easy to follow.

## Demo rhythm

1. Skim the numbered sections in `scripts/run-dataset.ts`.
2. Configure the `keyword_overlap` code evaluator for experiment observations.
3. Configure the Correctness evaluator for the same experiment observations.
4. Run `npm run dataset:run`.
5. Open the run table, per-item traces, and chart view.

## Watch for

- Code evaluator target. It should point at the root `dad-it-support-chat-turn` agent observation, not the intermediate tool or model-call observations.
- Learners testing against the wrong observation shape. The workshop snippet tolerates a plain-string `output`, but the intended setup is still the root agent observation where the answer lives at `output.answer`.
- Correctness evaluator mapping. `query` comes from the observation input, `generation` from `$.answer`, and `ground_truth` from `$.idealAnswer`.
- "No default model set" means Langfuse needs an LLM connection/default evaluator model; it is not fixed by editing `.env`.
- Slow asynchronous evaluator results; refresh after the run finishes.
