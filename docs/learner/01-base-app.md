# 01 Base App

## Starting point

The setup is complete, but we have not added Langfuse yet.

## Goal

Build a working Dad IT Support Agent that already uses the OpenAI SDK and local tool calling.

## What you need to do

1. Keep one fixed Dad support context instead of multiple user profiles.
2. Build the minimal chat UI around that one known setup.
3. Add two local tools:
   - `get_support_context`
   - `search_help_library`
4. Implement the OpenAI tool-calling loop on the server.
5. Keep the prompt local in code for now.

## Files you are expected to change

- `src/client/App.tsx`
- `src/client/styles.css`
- `src/server/index.ts`
- `src/server/support-agent.ts`
- `src/server/tools.ts`
- `src/server/support-data.ts`
- `src/server/local-prompt.ts`

## How to verify you are done

- The app runs with only `OPENAI_API_KEY`.
- Dad can ask practical iPhone or laptop questions.
- The model can call local tools and answer with grounded steps.
- There is still no Langfuse tracing in the app logic yet.

## End state

This finished app becomes the starting point for `02-tracing`.
