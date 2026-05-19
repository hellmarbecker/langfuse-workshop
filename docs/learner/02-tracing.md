# 02 Tracing

## Starting point

You have a working OpenAI-based Dad IT Support Agent with no Langfuse tracing yet.

## Goal

Manually add the missing tracing pieces so one chat turn becomes a rich Langfuse trace.

## What you need to do

1. Initialize OpenTelemetry and the `LangfuseSpanProcessor`.
2. Wrap the OpenAI client with `observeOpenAI(new OpenAI())`.
3. Wrap the top-level chat-turn function with `observe(...)`.
4. Wrap the tool functions with `observe(...)`.
5. Set the root observation input and output deliberately.
6. Make sure the root input includes a `messages` array so later monitoring can map JSON paths from it.

## Files you are expected to change

- `src/server/instrumentation.ts`
- `src/server/support-agent.ts`
- `src/server/tools.ts`

## How to verify you are done

- A single user turn creates a trace in Langfuse.
- The trace shows:
  - `dad-it-support-chat-turn`
  - the OpenAI generation
  - the tool calls
- The root observation input contains `messages`.
- The root observation output contains `answer`.

## End state

This finished traced app is the starting point for `03-prompt-management` and `04-monitoring`.
