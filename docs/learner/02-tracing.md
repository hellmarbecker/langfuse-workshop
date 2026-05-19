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

Add the import:

```ts
import { observe } from "@langfuse/tracing";
```

Then **replace your existing `runSupportConversation` function entirely** with the block below — same body, just relocated inside `observe(...)`, with a thin re-export beneath:

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
