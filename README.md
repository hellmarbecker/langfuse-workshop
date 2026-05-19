# Langfuse Dad IT Support Workshop

This repository is a compact TypeScript workshop app that teaches the Langfuse AI engineering loop end to end around one concrete sample: a web chat called Dad IT Support Agent.

The sample app stays intentionally small:

- `React + Vite` gives us a memorable but lightweight web chat.
- `Express + TypeScript` keeps model calls, tools, tracing, and experiment runs on the server where they are easy to inspect.
- `OpenAI` is the model provider from the very first runnable app.
- `Langfuse Cloud EU` is the default setup target.

## Workshop goals

- Make tracing feel concrete, not abstract.
- Show prompt management as a collaboration tool, not just a config trick.
- Show monitoring as a way to catch interesting production behavior.
- Show datasets and experiments as the bridge from production insight to systematic improvement.

## Quickstart

1. Copy `.env.example` to `.env`.
2. Add `OPENAI_API_KEY`.
3. Add Langfuse keys if you want tracing, prompts, datasets, and experiments.
4. Install dependencies with `npm install`.
5. Run `npm run dev`.
6. Open [http://127.0.0.1:3333](http://127.0.0.1:3333).

If only `OPENAI_API_KEY` is configured, the app still runs with the local fallback prompt.

## Workshop map

- [Setup](./docs/00-setup.md)
- [Base App](./docs/01-base-app.md)
- [Tracing](./docs/02-tracing.md)
- [Prompt Management](./docs/03-prompt-management.md)
- [Monitoring](./docs/04-monitoring.md)
- [Dataset](./docs/05-dataset.md)
- [Experiments](./docs/06-experiments.md)
- [Prompt Iteration](./docs/07-prompt-iteration.md)
- [Wrap-up](./docs/08-wrap-up.md)
- [Checkpoint strategy](./docs/checkpoints.md)
- [Learner path](./docs/learner/README.md)

## Repo layout

- `src/client`: the web chat UI
- `src/server`: the Dad IT Support Agent, tools, prompt loading, and tracing hooks
- `scripts`: prompt publishing, dataset seeding, and experiment runs
- `data/seed-dataset.json`: the initial workshop dataset
- `docs`: instructor narration and learner step-by-step guides

## Current architecture

- One fixed support context for Dad instead of multiple switchable profiles
- Two local tools:
  - `get_support_context`
  - `search_help_library`
- One OpenAI tool-calling loop in [`src/server/support-agent.ts`](/Users/annabellschafer/Documents/New%20project/src/server/support-agent.ts)
- Langfuse tracing through:
  - `observeOpenAI(new OpenAI())`
  - `observe(...)` wrappers for app functions and tool functions
  - OpenTelemetry initialization in [`src/server/instrumentation.ts`](/Users/annabellschafer/Documents/New%20project/src/server/instrumentation.ts)

## Stitchable checkpoints

The repo is structured so later milestones can still run if an earlier workshop section is skipped:

- `01-base-app` already uses OpenAI but does not require Langfuse yet.
- `02-tracing` adds observability without changing the visible product behavior.
- `03-prompt-management` falls back to the local prompt when the Langfuse prompt is missing.
- `04-monitoring` relies on the stable observation input and output shape created in tracing.
- `05` onward reuse the same server-side app logic as the web UI.

That means each finished step becomes the next step’s starting point, while later checkpoints still remain runnable if you jump ahead during a live workshop.
