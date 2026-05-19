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

### Wrap the agent function

In `src/server/support-agent.ts`, add the import:

```ts
import { observe } from "@langfuse/tracing";
```

Then **replace your existing `runSupportConversation` function entirely** with the block below. The body is the same as before — it has just been moved inside an `observe(...)` call, and a thin re-export sits underneath:

```ts
const observedRunSupportConversation = observe(
  async (request: ChatRequest): Promise<ChatResponse> => {
    const context = getSupportContext();
    const promptText = compileLocalPrompt(
      getLocalPromptTemplate("baseline"),
      buildPromptVariables(context)
    );
    const transcript: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: promptText
      },
      ...toOpenAIMessages(request.messages)
    ];
    const usedTools = new Set<string>();

    let finalAnswer = "";

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await openai.chat.completions.create({
        model: env.openaiModel,
        temperature: 0.2,
        messages: transcript,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto"
      });

      const message = response.choices[0]?.message;

      if (!message) {
        throw new Error("OpenAI returned no assistant message.");
      }

      transcript.push(message as OpenAI.Chat.Completions.ChatCompletionMessageParam);

      const toolCalls = message.tool_calls ?? [];

      if (toolCalls.length === 0) {
        finalAnswer = readAssistantText(message);
        break;
      }

      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") {
          continue;
        }

        usedTools.add(toolCall.function.name);

        const parsedArguments = parseToolArguments(toolCall.function.arguments);
        const result =
          parsedArguments === null
            ? {
                ok: false,
                error: `The tool arguments for ${toolCall.function.name} were not valid JSON.`
              }
            : await executeTool(toolCall.function.name, parsedArguments);

        transcript.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }

    if (!finalAnswer) {
      finalAnswer =
        "I ran out of room before finishing that answer. Please ask the question once more in a slightly shorter way.";
    }

    return {
      answer: finalAnswer,
      promptSource: "local",
      usedTools: [...usedTools],
      traceMeta: {
        contextId: context.id,
        contextLabel: context.label,
        model: env.openaiModel
      }
    };
  },
  { name: "dad-it-support-chat-turn", asType: "agent" }
);

export async function runSupportConversation(request: ChatRequest): Promise<ChatResponse> {
  return observedRunSupportConversation(request);
}
```

`observe(...)` auto-captures the function argument as the trace input and the return value as the trace output.

### Wrap each tool

In `src/server/tools.ts`, add the import and **replace your existing `executeTool` block** with the three definitions below:

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
