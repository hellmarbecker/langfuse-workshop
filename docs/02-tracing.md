# 02 Tracing

This checkpoint introduces the first Langfuse mental-model moment: the app is no longer a black box.

## Goal

Capture a full turn as a rich nested trace that shows:

- the root agent workflow
- the model generation
- the tool calls
- input and output
- latency and token usage

## Trace structure in this repo

The server creates:

- root observation:
  - name: `parent-support-chat-turn`
  - type: `agent`
- nested generation:
  - name: `anthropic-message`
  - type: `generation`
- nested tool spans:
  - `get_profile_context`
  - `search_help_library`

## Files to point at

- `src/server/instrumentation.ts`
- `src/server/anthropic-agent.ts`

## What to inspect in Langfuse

- the full conversation input on the root observation
- the final answer on the root observation output
- the Anthropic generation input and output
- token usage on the generation
- tool span outputs and timing

## Demo suggestion

Ask one question that clearly triggers both tools, such as:

- “How do I turn Bluetooth on for Mum’s phone?”

Then open the trace and narrate:

1. The root observation is one user turn.
2. The generation decides what to do.
3. The tool spans show what the agent looked up.
4. The final answer is grounded in those tool results.

## Teaching point

This is the moment where “trace” stops being an abstract observability word and becomes an actual debugging surface.

