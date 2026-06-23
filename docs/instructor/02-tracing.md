---
title: "Workshop: Instructor Notes for Tracing"
description: "Facilitator notes for teaching Langfuse tracing in three layers: Claude generations, one agent root, and tool observations."
---

# 02 Tracing

Learner guide: [02 Tracing](../learner/02-tracing.md)

## Instructor notes

- Teach the progression in three visible layers: Claude generations, one agent root, then tool observations.
- Keep the code changes small and local. The point is to show that Langfuse wraps existing app boundaries instead of forcing an architecture rewrite.
- The user/session propagation section is optional live, but later checkpoints include it so the following chapters have attribution available.

## Demo rhythm

1. Add `LangfuseSpanProcessor` and a hand-opened `startObservation(..., { asType: "generation" })` around the `messages.create` call, run one turn, show separate generation traces.
2. Wrap `runSupportConversationInner` with `observe(...)`, run again, show nested generations.
3. Wrap the two local tool helpers, run again, show the full tree.

## Watch for

- An occasional blank parent container around `dad-it-support-chat-turn` right after Step 2. Refresh once before treating it as a code bug; if it persists every turn, check for accidental extra tracing wrappers beyond the single `observe(...)` in the lesson.
- Learners looking for an auto-instrumentation wrapper for the Anthropic client like OpenAI's `observeOpenAI`. There isn't one — the generation observation is opened by hand around each `messages.create` call, and `.update(...)`/`.end()` close it.
- Missing shutdown flush in `index.ts`; traces can arrive late without it.
