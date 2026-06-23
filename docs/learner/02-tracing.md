---
title: "Workshop: Tracing an LLM Agent with Langfuse"
description: "Instrument the support agent so one chat turn becomes a nested Langfuse trace with Claude generations, agent spans, and tool calls."
---

# 02 Tracing

## Starting point

```bash
git checkout checkpoint/02-tracing
```

This is the blank slate for the tracing step — same code as `checkpoint/01-base-app`, with no Langfuse wiring yet. The Langfuse packages are already in `package.json` — run `npm install` if you haven't. Make sure `.env` has your `ANTHROPIC_API_KEY` and Langfuse keys.

## Why we trace

Tracing logs every step your agent takes — every model call, every tool invocation, the inputs that went in and the outputs that came back — in the order they happened. It turns the agent from a black box into something you can open up and inspect after the fact, so when an answer is wrong you can point at the exact step where it went wrong instead of guessing.

If you want the bigger-picture motivation, see the [Langfuse Academy lesson on tracing](https://langfuse.com/academy/tracing). If you want the technical details (SDK options, OpenTelemetry internals, span attributes), the [tracing docs](https://langfuse.com/docs/tracing) cover that.

## Goal

When Dad asks "How do I turn Bluetooth on?", the agent doesn't just hit Claude once. Behind the scenes it asks Claude what to do, calls `get_support_context` to fetch Dad's iPhone setup, asks Claude again, calls `search_help_library` for Bluetooth steps, then asks Claude one more time to produce the numbered answer. None of that is visible today.

The goal of this chapter is to make every one of those steps visible in Langfuse — one chat turn becomes one nested trace with the agent run, the Claude generations, and the two tool calls all logged in order.

![Spec's step by step process](../images/tracing/process_illustration.png)

We will build up the trace in three steps that mirror the agent's structure:

1. **First trace** — log the Claude generations themselves.
2. **Nested traces** — group the generations under one agent run per turn.
3. **Recording tool calls** — make each tool invocation its own observation.


## Step 1 — First trace

We want observability on the Claude calls themselves to see what the inputs and outputs are, and how much cost, tokens and time is spent. Two changes are enough.

### `src/server/index.ts`

Start the Langfuse span processor near the top of the file:

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] }).start();
```

The processor reads `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL` from the Node process environment. In this workshop, the server loads the repository `.env` before the Langfuse SDK starts, so edit `.env` instead of relying on exported shell values.

Side note: if the last trace sometimes shows up late when you stop or restart `npm run dev`, come back to `index.ts` and turn the one-liner above into named `langfuseSpanProcessor` and `sdk` variables so `shutdown()` can flush them:

```ts
const langfuseSpanProcessor = new LangfuseSpanProcessor();
const sdk = new NodeSDK({ spanProcessors: [langfuseSpanProcessor] });
sdk.start();

async function shutdown() {
  server.close();
  await langfuseSpanProcessor.forceFlush();
  await sdk.shutdown();
}
```

You do not need this to understand the tracing model, but it avoids confusing "where did my last trace go?" moments in local dev.

### `src/server/support-agent.ts`

Langfuse ships a one-line auto-instrumentation wrapper for the OpenAI SDK (`observeOpenAI`), but there is no equivalent for the Anthropic SDK — so we trace each model call by hand. It is still only a few lines: open a **generation** observation right before the call, then record the output and token usage when it returns.

Add the import:

```ts
import { startObservation } from "@langfuse/tracing";
```

Then, inside the loop in `runSupportConversation`, find the Messages API call:

```ts
const response = await anthropic.messages.create({
  model: env.anthropicModel,
  max_tokens: 1024,
  system: SYSTEM_PROMPT,
  tools: TOOL_DEFINITIONS,
  messages: transcript
});
```

and wrap it in a generation observation:

```ts
const generation = startObservation(
  "dad-it-support-generation",
  {
    model: env.anthropicModel,
    input: { system: SYSTEM_PROMPT, messages: transcript },
    modelParameters: { max_tokens: 1024 }
  },
  { asType: "generation" }
);

const response = await anthropic.messages.create({
  model: env.anthropicModel,
  max_tokens: 1024,
  system: SYSTEM_PROMPT,
  tools: TOOL_DEFINITIONS,
  messages: transcript
});

generation.update({
  output: response.content,
  usageDetails: {
    input: response.usage.input_tokens,
    output: response.usage.output_tokens
  }
});
generation.end();
```

`startObservation(name, attributes, { asType: "generation" })` opens the observation; `.update(...)` attaches the response and token counts; `.end()` closes it. Because the loop runs once per model call, each turn emits one generation per round-trip.

> The finished reference app also records the failing call on error (`generation.update({ level: "ERROR", ... })`) and links the Langfuse-managed prompt — that prompt link comes in `03-prompt-management`. Keep it to the basics here.


**Verify:** `npm run dev`, ask one question, refresh Langfuse — you should see one generation per Claude call with prompt, response, tokens, and latency. Each generation is still its own top-level trace; we fix that next.

![Langfuse Traces view after Step 1 — each chat turn appears as standalone dad-it-support-generation generations.](../images/tracing/02-tracing-step-1.png)

## Step 2 — Nested traces

To put the generations into context we group them under one agent run per turn. Three edits in `src/server/support-agent.ts` — no function body changes.

**1. Add the import:**

```ts
import { observe } from "@langfuse/tracing";
```

**2. Demote the existing function.** Find:

```ts
export async function runSupportConversation(request: ChatRequest): Promise<ChatResponse> {
```

Drop the `export` and rename it:

```ts
async function runSupportConversationInner(request: ChatRequest): Promise<ChatResponse> {
```

The body stays exactly as it is.


**3. Add the wrapped export at the bottom of the file:**

```ts
export const runSupportConversation = observe(runSupportConversationInner, {
  name: "dad-it-support-chat-turn",
  asType: "agent"
});
```

`index.ts` still imports `runSupportConversation` the same way. `observe(...)` auto-captures the function argument as the trace input and the return value as the trace output.

**Verify:** one chat turn should now show up as a single `dad-it-support-chat-turn` observation with the Claude generation nested underneath.

![Trace tree after Step 2 — one dad-it-support-chat-turn agent root with the Claude generation as a child.](../images/tracing/02-tracing-step-2.png)



## Step 3 — Recording tool calls

The Claude generation already mentions the tool calls in its `tool_use` output, but we have no observation for the actual tool execution — no way to see what input went in and what came out. The same `observe(...)` pattern, can be applied to each tool.

### `src/server/tools.ts`

Add the import and the two observed helpers above `executeTool`, then redirect the switch at them. `TOOL_DEFINITIONS` stays untouched.

```ts
import { observe } from "@langfuse/tracing";

const getSupportContextTool = observe(
  async () => {
    const context = getSupportContext();

    return {
      ok: true,
      context: {
        id: context.id,
        label: context.label,
        devices: context.devices,
        deviceSummary: context.deviceSummary,
        responseStyle: context.responseStyle,
        scopeHighlights: context.scopeHighlights,
        notableApps: context.notableApps
      }
    };
  },
  { name: "get_support_context", asType: "tool" }
);

const searchHelpLibraryTool = observe(
  async (input: { question: string }) => {
    const guides = searchGuides(input.question);

    return {
      ok: true,
      results: guides.map((guide) => ({
        id: guide.id,
        title: guide.title,
        summary: guide.summary,
        steps: guide.steps,
        caution: guide.caution ?? null
      }))
    };
  },
  { name: "search_help_library", asType: "tool" }
);

export async function executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "get_support_context":
      return getSupportContextTool();

    case "search_help_library":
      return searchHelpLibraryTool({ question: String(input.question ?? "") });

    default:
      return { ok: false, error: `Unsupported tool: ${name}` };
  }
}
```

![Full trace after Step 3 — dad-it-support-chat-turn (agent) with the Claude generation and get_support_context + search_help_library tool observations as siblings underneath.](../images/tracing/02-tracing-step-3.png)


## How to verify you are done

- A single user turn creates one trace in Langfuse.
- Root observation: `dad-it-support-chat-turn` (type `agent`).
- Child generation `dad-it-support-generation` (type `generation`) with prompt, response, tokens, latency.
- Child tool observations: `get_support_context`, `search_help_library`.
- Root input is the chat request; root output is the chat response.

## Wrap-up

Same concept throughout, two complementary primitives: `observe(fn, { asType })` wraps a whole function and emits a span with the name and type you give it (we used it for the agent root and the tools), while `startObservation(name, attrs, { asType: "generation" })` opens an observation you fill in and close by hand — the right tool for the model call, since the Anthropic SDK has no Langfuse auto-instrumentation wrapper.

A more straightforward way to add rich tracing in line with Langfuse best practices is the [**Langfuse skill**](https://github.com/langfuse/skills) (`/langfuse`). It applies the recommended patterns to your codebase without you hand-rolling each wrap. This walkthrough exists so you understand what the skill is doing under the hood.

Some SDKs do have a one-line Langfuse wrapper — `observeOpenAI` for the OpenAI JS SDK, plus auto-instrumentation for the Vercel AI SDK and others. If you are on one of those, the Langfuse [integrations catalogue](https://langfuse.com/integrations) gives you the lower-effort path instead of the manual generation observation we used here for the Anthropic SDK.

## Appendix/Bonus section — User and session IDs

The walkthrough above gets you tracing with a clean parent → generation → tool shape. The next thing most teams want is to **slice traces by user and by session** — so you can pull up "every turn this user has had with the agent" or "the full multi-turn session from yesterday morning."
For simplicity reasons we skip this step in the live tracing walkthrough, but the checkpoints after tracing include it so later chapters can use session/user views without another code step. See information on [Sessions](https://langfuse.com/docs/observability/features/sessions) and [Users](https://langfuse.com/docs/observability/features/users) in the Langfuse docs.

In short:

```ts
import { propagateAttributes } from "@langfuse/tracing";

return propagateAttributes(
  {
    userId: request.userId ?? `workshop-${context.id}`,
    sessionId: request.sessionId,
    tags: ["langfuse-workshop", "dad-it-support"]
  },
  async () => {
    // ...the same tool-calling loop...
  }
);
```

Anything inside the `propagateAttributes(...)` block — including the generation and tool observations — automatically gets the `userId`, `sessionId`, and tags attached. The Langfuse **Users** view, **Sessions** view, and tag filters all light up as soon as the attributes are present.


## End state

This finished traced app is the starting point for `03-prompt-management` and `04-monitoring`.
