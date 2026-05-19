# 02 Tracing

## How to think about this step

This is the first real Langfuse moment. We take a working but opaque app and turn it into something we can inspect. The goal is not “add telemetry because telemetry is good.” The goal is “make one chat turn explain itself.”

## Goal

Capture a full turn as a rich nested trace that shows:

- the root agent workflow
- the OpenAI generation
- the local tool calls
- input and output
- latency and token usage

## Trace structure in this repo

After tracing is added, the server creates:

- root observation:
  - name: `dad-it-support-chat-turn`
  - type: `agent`
- nested generation:
  - name: `openai-chat-completion`
  - created by `observeOpenAI(...)`
- nested tool spans:
  - `get_support_context`
  - `search_help_library`

## Files to point at

- `src/server/instrumentation.ts`
- `src/server/support-agent.ts`
- `src/server/tools.ts`

## What to inspect in Langfuse

- the full `messages` array on the root observation input
- the final `answer` on the root observation output
- the OpenAI generation input and output
- token usage and latency on the generation
- tool outputs and timing

## Demo suggestion

Ask one question that clearly triggers both tools:

- “How do I reconnect the laptop to Wi-Fi?”

Then open the trace and narrate:

1. The root observation is one user turn.
2. The generation decides what to do.
3. The tool spans show what the agent looked up.
4. The final answer is grounded in those tool results.

## Teaching point

This is the moment where “trace” stops being an abstract observability word and becomes a debugging surface.
