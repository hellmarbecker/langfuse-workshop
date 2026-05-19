# 02 Tracing

## Starting point

```bash
git checkout checkpoint/02-tracing-start
```

This is the blank slate for the tracing step — same code as `checkpoint/01-base-app`, with no Langfuse wiring yet. The Langfuse packages are already in `package.json` — run `npm install` if you haven't. Make sure `.env` has your `OPENAI_API_KEY` and Langfuse keys. When you finish, you should be at the state captured by `checkpoint/02-tracing`.

## Goal

In two passes:

1. **Logging the first trace** — every OpenAI call shows up in Langfuse.
2. **Richer trace structure** — one chat turn becomes a nested trace with an agent root, the OpenAI generation, and the two tool calls.

User/session attribution and tags come in `04-monitoring`.

## Logging the first trace

### `src/server/index.ts`

Start the Langfuse span processor near the top of the file:

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] }).start();
```

The processor reads `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL` from the environment.

### `src/server/support-agent.ts`

Wrap the OpenAI client at module scope:

```ts
import { observeOpenAI } from "@langfuse/openai";

const openai = observeOpenAI(new OpenAI({ apiKey: env.openaiApiKey }));
```

**Then replace the call** in `runSupportConversation` — find:

```ts
const response = await getOpenAIClient().chat.completions.create({
```

and change it to:

```ts
const response = await openai.chat.completions.create({
```

Without this swap, the wrapped `openai` is a dead variable and no traces are emitted. The old `getOpenAIClient()` helper becomes unused and can be deleted.

**Verify:** `npm run dev`, ask one question in the UI, refresh Langfuse — you should see one generation with prompt, response, tokens, and latency.

## Richer trace structure

### `src/server/support-agent.ts`

Three surgical edits — you do not touch the function body.

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

### `src/server/tools.ts`

Add the import and **replace the existing `executeTool` block** with the three definitions below. `TOOL_DEFINITIONS` at the top of the file stays untouched.

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

## Where the bootstrap lives in this repo

`src/server/instrumentation.ts` already wraps the inline `NodeSDK.start()` snippet from above with two helpers, `ensureTracingInitialized()` (no-op when keys are missing) and `shutdownTracing()` (flushes spans on exit), and `index.ts` calls those instead of inlining. You do not need to edit either file — read `instrumentation.ts` once and move on.

## How to verify you are done

- A single user turn creates a trace in Langfuse.
- Root observation: `dad-it-support-chat-turn` (type `agent`).
- Child generation from `observeOpenAI(...)` with prompt, response, tokens, latency.
- Child tool observations: `get_support_context`, `search_help_library`.
- Root input is the chat request; root output is the chat response.

## End state

This finished traced app is the starting point for `03-prompt-management` and `04-monitoring`.
