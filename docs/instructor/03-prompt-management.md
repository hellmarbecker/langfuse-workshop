# 03 Prompt Management

## Why manage prompts

Keeping the system prompt in code means every prompt change is a code change: pull request, review, build, deploy. With Langfuse prompt management the prompt lives in Langfuse — versioned, labelled, and editable in the UI — and the app fetches it at request time. That means non-engineers can iterate on prompts, changes ship independent of release cycles, and every version is preserved and linked to the traces it produced.

Learn more in the [Langfuse prompts docs](https://langfuse.com/docs/prompts).

## Goal

By the end of this step the running app loads its system prompt template from Langfuse, compiles it with three context variables, and links every OpenAI generation back to the published version.

There is **no local fallback** — if Langfuse isn't reachable or the prompt is missing, the chat fails loudly. The previous chapter's local compile is gone; Langfuse is the runtime source of truth.

![How Specs handles a ticket — one agent, two tools, one model, each hop an observation in the trace.](./images/specs_illustration.png)

## Starting point

```bash
git checkout checkpoint/03-prompt-management
```

The agent uses `SYSTEM_PROMPT` (a templated string in `src/server/support-agent.ts`) plus a local `getPrompt(context)` that compiles its three placeholders (`{{user_label}}`, `{{response_style}}`, `{{scope_summary}}`) from the support context. Two steps:

1. **Publish** the templated `SYSTEM_PROMPT` to Langfuse so a versioned copy lives there.
2. **Replace the local compile with a Langfuse fetch** and link the resulting prompt to every OpenAI generation via `observeOpenAI`.

Set these env vars in `.env`:

```bash
LANGFUSE_PROMPT_NAME=dad-it-support-agent
LANGFUSE_PROMPT_LABEL=production
```

## Step 1 — Publish the prompt (Langfuse UI)

The fastest way to create a prompt is to add it manually in the UI — same workflow your team will use for every future iteration.

1. In Langfuse, open **Prompts → New prompt**.
2. Name it `dad-it-support-agent` (matching `LANGFUSE_PROMPT_NAME`).
3. Type: `text`.
4. Paste the body of `SYSTEM_PROMPT` from `src/server/support-agent.ts` — including the three `{{}}` placeholders.
5. Label the version `production` (matching `LANGFUSE_PROMPT_LABEL`).
6. Save.

![Creating the dad-it-support-agent prompt in Langfuse.](./images/prompt-management/03-prompt-management-new-prompt-form.png)

> 💡 *Alternative — publish via script.* `scripts/publish-prompt.ts` pushes the local `SYSTEM_PROMPT` constant to Langfuse for you (`npm run prompt:publish`). The manual UI flow above is the same workflow your team will use for ongoing iteration, so we lead with it.

## Step 2 — Replace the local compile with a Langfuse fetch

The agent currently compiles `SYSTEM_PROMPT` locally with `buildPromptVariables(context)`. We swap the body of `getPrompt` for a Langfuse fetch — same compile-three-variables shape, new source.

The change in `src/server/support-agent.ts`:

```ts
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Replaces the local getPrompt from the previous checkpoint.
async function getPrompt() {
  return await langfuse.prompt.get(env.langfusePromptName);
}

// inside runSupportConversationInner — fetch and compile with the
// same three variables we used locally:
const langfusePrompt = await getPrompt();
const systemPrompt = langfusePrompt.compile(buildPromptVariables(context));

// the same observeOpenAI call from step 02, with one extra argument:
const openai = observeOpenAI(
  new OpenAI({ apiKey: env.openaiApiKey }),
  { langfusePrompt }
);
```

Three things to notice:

- The `observeOpenAI(...)` call itself didn't change — same client, same inline wrap as step 02. We just added a second argument carrying the `langfusePrompt`. Keeping the client inline (no factory) is what makes this diff so small.
- `langfusePrompt.compile(buildPromptVariables(context))` is the same three-variable compile we had locally. The Langfuse SDK does the placeholder substitution exactly the way the local `.replaceAll(...)` chain did.
- Passing `langfusePrompt` into `observeOpenAI`'s options is what makes every generation carry the **Prompt** badge linking back to the exact published version. The [Langfuse OpenAI JS integration docs](https://langfuse.com/integrations/model-providers/openai-js) show the canonical pattern.

**No fallback.** Marc's call: the previous chapter has the local `SYSTEM_PROMPT` + local compile; this chapter replaces both with Langfuse. If Langfuse keys are missing or the prompt isn't published, the agent throws and we see the failure rather than silently rendering the wrong prompt.

## Run and verify

```bash
npm run dev
```

Ask a question, then in Langfuse:

1. Open the trace. The OpenAI generation row should show a small **Prompt** badge linking to `dad-it-support-agent` at the version you just published.
2. Open `dad-it-support-agent` in Prompts → scroll to "Used in" → your trace appears.

![A traced openai-chat-completion with the Prompt badge linking back to dad-it-support-agent · v1.](./images/prompt-management/03-prompt-management-prompt-badge.png)

## Teaching point

Tracing without prompt management is a one-way street: you can see what the model did but you can't tell which prompt change caused which behavior. Prompt management closes the loop. Now every change in the Langfuse UI is a new version, every trace points at its version, and the eval and monitoring steps can compare versions head-to-head.

A more straightforward way to wire prompt management in line with Langfuse best practices is the [**Langfuse skill**](https://langfuse.com/docs) (`/langfuse`). It applies the recommended patterns automatically. The hand-rolled walkthrough in this step exists so you understand what the skill is doing under the hood.
