# 03 Prompt Management

## Starting point

You already have the traced app from step 2.

## Goal

Replace the code-only prompt path with a Langfuse-managed prompt plus a local fallback.

## What you need to do

1. Keep the local prompt template in code as the fallback.
2. Add a prompt loader that fetches the prompt from Langfuse.
3. Compile the prompt with variables from Dad's support context.
4. Return both the rendered prompt text and prompt-source metadata.
5. Add a script to publish the starter prompt to Langfuse.
6. Pass the Langfuse prompt object into the OpenAI integration so generations can link back to the prompt version.

## Files you are expected to change

- `src/server/local-prompt.ts`
- `src/server/prompt-manager.ts`
- `src/server/support-agent.ts`
- `scripts/publish-prompt.ts`

## How to verify you are done

- The app still works when the Langfuse prompt does not exist yet.
- After publishing the prompt, the app uses the Langfuse prompt.
- The trace clearly shows whether the prompt source was `local` or `langfuse`.

## End state

This finished state becomes the starting point for `04-monitoring`.
