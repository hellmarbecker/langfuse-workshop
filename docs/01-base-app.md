# 01 Base App

## How to think about this step

This step is about the product surface, not observability yet. The app should already be small, concrete, and believable before we instrument anything.

## Goal

Show a working Dad IT Support Agent that:

- uses the official OpenAI SDK
- has one fixed Dad support context
- answers practical device questions
- uses local tools for context lookup and guide lookup
- still has no Langfuse tracing

## What is in the app

- One fixed Dad context, not multiple switchable profiles
- A minimal web chat UI
- One OpenAI tool-calling loop
- Two local tools:
  - `get_support_context`
  - `search_help_library`

## Files to point at

- `src/client/App.tsx`
- `src/server/index.ts`
- `src/server/support-agent.ts`
- `src/server/tools.ts`
- `src/server/support-data.ts`
- `src/server/local-prompt.ts`

## Demo suggestion

Ask one or two concrete questions:

- “How do I print a PDF from the laptop?”
- “How do I turn Bluetooth on on my iPhone?”

## Teaching point

Before we talk about traces or evaluations, everyone should understand the actual product shape we are trying to improve. The smaller and clearer the app is, the easier the rest of the workshop becomes.
