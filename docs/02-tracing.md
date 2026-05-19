# 02 Tracing

## How to think about this step

This is the first real Langfuse moment. We take a working but opaque app and turn it into something we can inspect. We do it in two passes: get one trace flowing, then add the structure that makes the trace useful.

## Goal

By the end of this step:

- every OpenAI call in the app shows up as a trace in Langfuse
- one chat turn is a nested trace with an agent root, the OpenAI generation, and the two tool calls

User/session attribution, tags, and metadata are intentionally left for `04-monitoring`.

## Starting point

```bash
git checkout checkpoint/02-tracing-start
```

This tag is the blank slate for this step: the base app from `checkpoint/01-base-app`, with no Langfuse wiring yet. The Langfuse packages are already in `package.json` (`@langfuse/otel`, `@langfuse/openai`, `@langfuse/tracing`, `@opentelemetry/sdk-node`). Run `npm install` if you haven't. Make sure `.env` has your `OPENAI_API_KEY` and Langfuse keys.

When you finish all of the steps below, the result should match `checkpoint/02-tracing`.

## Logging the first trace

Two changes, and every OpenAI call in the app is traced.

**Start the Langfuse span processor.** In `src/server/index.ts`, near the top:

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] }).start();
```

The processor reads `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL` from the environment.

**Wrap the OpenAI client.** In `src/server/support-agent.ts`, add the import and define a wrapped client at module scope:

```ts
import { observeOpenAI } from "@langfuse/openai";

const openai = observeOpenAI(new OpenAI({ apiKey: env.openaiApiKey }));
```

**Then actually use it.** Find this line in `runSupportConversation`:

```ts
const response = await getOpenAIClient().chat.completions.create({
```

and replace it with:

```ts
const response = await openai.chat.completions.create({
```

Without this swap, the wrapped `openai` is a dead variable and no traces will be emitted. The old `getOpenAIClient()` helper becomes unused — leave it or delete it, your call.

That is the whole minimum. Run `npm run dev`, ask one question in the UI, open Langfuse, and you should see one generation with the prompt, the response, the model, tokens, and latency.

## Richer trace structure

The first-trace version shows each OpenAI call as its own top-level generation. Tool calls live inside the generation’s `tool_calls` field, and there is no “one turn” parent grouping everything. We fix both with `observe(...)`.

The key insight: `observe(fn, opts)` accepts any async function reference and returns a wrapped version with the same signature. That means we don't have to relocate the existing function body — we just rename it, then export a wrapped version.

### Wrap the agent function — three surgical edits

**1. Add the import** to `src/server/support-agent.ts`:

```ts
import { observe } from "@langfuse/tracing";
```

**2. Demote the existing function.** Find this line:

```ts
export async function runSupportConversation(request: ChatRequest): Promise<ChatResponse> {
```

Drop the `export` and rename it:

```ts
async function runSupportConversationInner(request: ChatRequest): Promise<ChatResponse> {
```

The function body stays exactly as it is. You do not touch it.

**3. Add the wrapped export at the bottom of the file:**

```ts
export const runSupportConversation = observe(runSupportConversationInner, {
  name: "dad-it-support-chat-turn",
  asType: "agent"
});
```

`index.ts` still imports `runSupportConversation` the same way — it just happens to be a `const` now. `observe(...)` auto-captures the argument as the trace input and the return value as the trace output.

### Wrap each tool

In `src/server/tools.ts`, the inline switch bodies in `executeTool` can't be observed in place — each tool has to be its own function so `observe` has something to wrap. Add the import and the two observed helpers above `executeTool`, then redirect the switch at them.

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

`TOOL_DEFINITIONS` at the top of the file stays untouched.

## Where the bootstrap lives in this repo

For production use it's nicer to skip tracing cleanly when Langfuse keys are missing and to flush on shutdown. In this repo that's factored into `src/server/instrumentation.ts`, which exposes `ensureTracingInitialized()` and `shutdownTracing()`. The body is the same `LangfuseSpanProcessor` + `NodeSDK.start()` you saw above. `src/server/index.ts` calls those helpers instead of inlining.

You don't have to write `instrumentation.ts` to follow this step — the inline snippet works. Reading it once is enough.

## Run and verify

```bash
npm run dev
```

Ask one question that triggers both tools — for example, *“How do I reconnect my iPhone to Wi-Fi?”* — then open Langfuse and check:

1. One root `dad-it-support-chat-turn` observation per turn.
2. One nested OpenAI generation showing prompt, response, tokens, latency.
3. Two nested tool observations (`get_support_context`, `search_help_library`) with their inputs and outputs.

## Teaching point

Two lines (`LangfuseSpanProcessor.start()` + `observeOpenAI(...)`) are enough to see *that* the model was called. `observe(...)` on the agent and tools is what turns that flat generation log into a structured trace you can actually debug — and is what monitoring, datasets, and experiments hang off in the later steps.
