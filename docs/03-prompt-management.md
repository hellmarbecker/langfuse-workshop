# 03 Prompt Management

## How to think about this step

Prompt management is not a separate product from tracing. It becomes useful because traces tell us which prompt version produced which behavior.

## Goal

Move from a code-only prompt to a Langfuse-managed prompt with a safe local fallback.

## What changes in this step

- The local prompt still exists in code.
- The server tries to fetch the prompt from Langfuse first.
- If the prompt is missing, the app falls back to the local prompt.
- OpenAI generations can be linked back to the Langfuse prompt version.

## Files to point at

- `src/server/local-prompt.ts`
- `src/server/prompt-manager.ts`
- `scripts/publish-prompt.ts`

## Useful environment variables

```bash
LANGFUSE_PROMPT_NAME=dad-it-support-agent
LANGFUSE_PROMPT_LABEL=production
WORKSHOP_PROMPT_VARIANT=baseline
```

## Demo suggestion

1. Publish the prompt from code.
2. Run the app again.
3. Ask one question.
4. Open the trace and show that the prompt source is now `langfuse`.

## Teaching point

Prompt management is valuable because it gives us versioned prompt changes that stay connected to traces, monitors, and experiments.
