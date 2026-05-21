# 03 Prompt Management

## Starting point

```bash
git checkout checkpoint/03-prompt-management
```

You have a working traced app. The system prompt is a constant called `SYSTEM_PROMPT` in `src/server/support-agent.ts`, and a local `getPrompt(context)` function compiles its `{{user_label}}`, `{{response_style}}`, and `{{scope_summary}}` placeholders from the support context.

In this chapter we move that prompt into Langfuse so it's versioned and editable in the UI, and we replace the local compile with a Langfuse fetch — same `getPrompt` interface, new implementation.

Make sure `.env` has:

```bash
LANGFUSE_PROMPT_NAME=dad-it-support-agent
LANGFUSE_PROMPT_LABEL=production
```

## Why manage prompts

Keeping the system prompt in code means every prompt change is a code change: pull request, review, build, deploy. With Langfuse prompt management the prompt lives in Langfuse — versioned, labelled, and editable in the UI — and the app fetches it at request time. That means non-engineers can iterate on prompts, changes ship independent of release cycles, and every version is preserved and linked to the traces it produced.

Learn more in the [Langfuse prompts docs](https://langfuse.com/docs/prompts).

## Goal

Two steps:

1. **Publish the system prompt template to Langfuse** so a versioned copy lives there.
2. **Fetch it back at request time**, compile it with the three template variables, and link each OpenAI generation to the version that produced it.


## Step 1 — Publish the prompt (Langfuse UI)

The most direct way to create a prompt is to add it manually in the UI — it's the same workflow your team will use for every future iteration.

1. In Langfuse, open **Prompts → New prompt**.
2. **Name** it `dad-it-support-agent` (matching `LANGFUSE_PROMPT_NAME` in your `.env`).
3. **Type** is `text`.
4. **Paste** the body below — it's the same string as `SYSTEM_PROMPT` in `src/server/support-agent.ts`, **including the three `{{}}` placeholders**:

```
You are {{user_label}}'s IT Support Agent.
You are talking directly to {{user_label}}. He opened this chat himself to get help with his iPhone.

You do not yet know which iPhone {{user_label}} has or which apps he uses — call get_support_context to find out before giving any device-specific instructions.

Response style:
{{response_style}}

Support scope:
{{scope_summary}}

Rules:
- Speak directly to {{user_label}} in second person ("you", "your iPhone"). Never refer to {{user_label}} in the third person.
- Call get_support_context as your very first tool call on each turn so you know which iPhone, iOS, and apps {{user_label}} has.
- For step-by-step help, call search_help_library before giving the final answer.
- Use short numbered steps with one action per line.
- Mention what {{user_label}} should expect to see on his screen after important taps.
- Be honest about limits. You cannot see his screen, passwords, or real-time location.
- If the request is out of scope, say so kindly and redirect to the closest iPhone-help you can give.
- Do not invent button names or settings paths that were not confirmed by tool results.
```

5. **Label** the version `production` (matching `LANGFUSE_PROMPT_LABEL` in your `.env`).
6. **Save**.

![Creating the dad-it-support-agent prompt in Langfuse.](../images/prompt-management/03-prompt-management-new-prompt-form.png)

> 💡 *Alternative — publish via script.* `scripts/publish-prompt.ts` pushes the `SYSTEM_PROMPT` constant up to Langfuse (`npm run prompt:publish`). Same outcome.
>
> *Production tip — auto-publish on dev start.* In CI or a `predev` npm script you can hook `npm run prompt:publish` so every dev-server start pushes the current `SYSTEM_PROMPT` to Langfuse. Pair that with a stable label and you'll never run with a stale version.

## Step 2 — Replace the local compile with a Langfuse fetch

The agent currently compiles `SYSTEM_PROMPT` locally with `buildPromptVariables(context)`. We swap that out for a Langfuse fetch — same shape, new source.

**Add the import** in `src/server/support-agent.ts`:

```ts
import { LangfuseClient } from "@langfuse/client";
```

**Construct the client at module scope:**

```ts
const langfuse = new LangfuseClient();
```

**Replace the local `getPrompt` function** with one that fetches from Langfuse:

```ts
async function getPrompt() {
  return await langfuse.prompt.get(env.langfusePromptName);
}
```

> No fallback. If Langfuse isn't reachable or the prompt is missing, the call throws and the chat fails loudly. The prompt has to exist in Langfuse (which Step 1 published). The previous step's local compile is gone now — Langfuse is the runtime source of truth.

**Update the call site** in `runSupportConversation`. The `buildPromptVariables(context)` helper from the previous step stays; we just pass its output into `langfusePrompt.compile(...)` instead of using it in a local replace:

```ts
const langfusePrompt = await getPrompt();
const systemPrompt = langfusePrompt.compile(buildPromptVariables(context));
```

**Pass `langfusePrompt` to the existing `observeOpenAI` call** — same wrap from step 02, just with a second argument so the generation gets linked to the prompt version:

```ts
const openai = observeOpenAI(
  new OpenAI({ apiKey: env.openaiApiKey }),
  { langfusePrompt }
);
```

Three things to notice:

- The `observeOpenAI(new OpenAI(...))` call itself didn't change — same inline wrap from step 02. We just added a second argument carrying the `langfusePrompt`. That's the smallest possible diff between this step and the previous one.
- `langfusePrompt.compile(buildPromptVariables(context))` is the same compile-three-variables step we had locally — Langfuse just owns the template body now.
- Passing `langfusePrompt` into `observeOpenAI` is what makes every generation under that client carry the **Prompt** badge linking back to the exact published version.

## Verify

```bash
npm run dev
```

Ask one question, then in Langfuse:

- Open the trace, click the OpenAI generation. It should show a **Prompt** badge linking to `dad-it-support-agent` at the version you published.
- In the Prompts view for `dad-it-support-agent`, scroll to "Used in" and your trace appears.

![A traced openai-chat-completion with the Prompt badge in the top-right linking back to dad-it-support-agent · v1.](../images/prompt-management/03-prompt-management-prompt-badge.png)

## Wrap-up

Prompt management is what closes the trace ↔ prompt loop. Every prompt version is preserved, every generation knows which version produced it, and you can iterate prompts independent of code deploys.

A more straightforward way to wire prompt management in line with Langfuse best practices is the [**Langfuse skill**](https://langfuse.com/docs) (`/langfuse`). The skill applies the recommended patterns to your codebase without you hand-rolling each piece. This walkthrough exists so you can see what the skill is doing under the hood.

## End state

This is the starting point for `04-monitoring`.
