# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A hands-on Langfuse workshop built around a small full-stack TypeScript app, the **Dad IT Support Agent** ("Specs"). The app is a vehicle for teaching the AI engineering loop: tracing → prompt management → monitoring → datasets → experiments → evaluation. `main` holds the complete reference implementation; each workshop step also lives at a `checkpoint/0X-*` git tag that learners check out and build forward from.

See `AGENTS.md` for the checkpoint strategy and the rule that **code/doc changes on `main` must be mirrored into any affected `checkpoint/*` tags** before a task is done.

## Commands

```bash
npm run dev          # vite client (127.0.0.1:3333) + tsx-watch server (127.0.0.1:8787) via concurrently
npm run dev:server   # server only
npm run dev:client   # client only
npm run build        # build:client (vite → dist/) then build:server (tsup → dist/server/)
npm run start        # run the built server (serves dist/ statically + /api)
npm run typecheck    # tsc --noEmit (no test suite exists)

npm run prompt:publish   # push SYSTEM_PROMPT (or a variant) to Langfuse — scripts/publish-prompt.ts
npm run dataset:seed     # seed the Langfuse dataset from data/seed-dataset.json
npm run dataset:run      # run the agent against the hosted dataset + score it
```

There is no linter and no test runner; `npm run typecheck` is the only static check.

## Environment

Every Node entrypoint imports `src/server/load-env.ts` (or `scripts/load-env`) **first**. It loads the repo-root `.env` with `override: true`, so the workshop `.env` is the single source of truth and beats any shell exports from other projects. Copy `.env.example` to `.env`. `src/server/env.ts` is the typed accessor for all config (OpenAI key/model, Langfuse keys/host, prompt name+label, dataset name); read config from `env`, never `process.env` directly.

The app degrades gracefully without Langfuse: missing credentials disable tracing (`isLangfuseConfigured()`), and a missing published prompt falls back to the local `SYSTEM_PROMPT`.

## Architecture

**Client/server split.** React + Vite client in `src/client/` calls an Express server in `src/server/`. In dev, Vite proxies `/api/*` to the server on port 8787. In production the server serves the built client from `dist/` and handles `/api`. Shared request/response types live in `src/shared/types.ts`.

**The agent loop** (`src/server/support-agent.ts`) is the core. `runSupportConversation` is the exported, traced entrypoint. It runs a standard OpenAI tool-calling loop (max 6 turns): seed transcript with system prompt + user messages, call `chat.completions.create` with `TOOL_DEFINITIONS`, execute any tool calls, append results, repeat until the model returns a final text answer. The two local tools (`get_support_context`, `search_help_library`) are defined and dispatched in `src/server/tools.ts` and read from the static fixtures in `src/server/support-data.ts` — there is no database or external data source.

**Langfuse tracing** is layered on without changing app logic, which is the whole point of the workshop progression:
- `src/server/index.ts` boots an OpenTelemetry `NodeSDK` with `LangfuseSpanProcessor` at startup and `forceFlush()`es on shutdown. Any script that needs traces (e.g. `run-dataset.ts`) does the same boot.
- `observe(fn, { name, asType })` wraps app/tool functions to emit spans (`asType: "agent"` for the conversation, `"tool"` for each tool).
- `observeOpenAI(new OpenAI(...))` auto-traces generations; passing `{ langfusePrompt }` links generations to the managed prompt.
- `propagateAttributes({ userId, sessionId, traceName, tags }, fn)` attaches user/session metadata to the trace tree.

**Prompt management.** `SYSTEM_PROMPT` is defined in `support-agent.ts` and is the local fallback. `scripts/publish-prompt.ts` pushes that same string (or the `gentler` variant, selected by `WORKSHOP_PROMPT_VARIANT`) to Langfuse under `LANGFUSE_PROMPT_NAME`/`LANGFUSE_PROMPT_LABEL`. At runtime the agent prefers the fetched Langfuse prompt and falls back to the local constant.

**Datasets & experiments** (`scripts/`). `seed-dataset.ts` uploads `data/seed-dataset.json` items (each carries `idealAnswer` + `expectedKeywords`). `run-dataset.ts` calls `dataset.runExperiment`, invoking the *same* `runSupportConversation` the web UI uses for each item, scoring it with the in-script deterministic `keywordOverlap` evaluator; the Langfuse-side Correctness LLM-as-judge evaluator runs asynchronously over the resulting run. Evaluation (step 07) changes the prompt and reruns the same dataset to compare `keyword_overlap` + `correctness` across runs.

## Conventions

- ESM throughout (`"type": "module"`), `moduleResolution: "Bundler"`, strict TS. Scripts are run with `tsx`, not compiled.
- The trace shape is a contract for the workshop: monitoring/evaluation depend on stable message-array inputs on the agent/generation observations and the root `answer` field. Don't reshape these casually — it breaks later lessons and the checkpoint tags.
- Workshop content lives in `docs/learner/` (self-guided lessons) and `docs/instructor/` (facilitator notes), paired per module 00–08. Per `AGENTS.md`, keep learner content out of instructor notes and don't recreate index/overview files.
