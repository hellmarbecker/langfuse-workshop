import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";
import { observe, propagateAttributes } from "@langfuse/tracing";
import { LangfuseClient } from "@langfuse/client";
import type { ChatMessage, ChatRequest, ChatResponse, SupportContext } from "../shared/types";
import { env } from "./env";
import { getSupportContext } from "./support-data";
import { TOOL_DEFINITIONS, executeTool } from "./tools";

// SYSTEM_PROMPT is kept here as the source of truth that
// scripts/publish-prompt.ts pushes to Langfuse. At runtime the agent
// fetches the prompt from Langfuse and compiles it with variables —
// see getPrompt() below.
export const SYSTEM_PROMPT = `You are {{user_label}}'s IT Support Agent.
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
`;

export function buildPromptVariables(context: SupportContext) {
  return {
    user_label: context.label,
    response_style: context.responseStyle,
    scope_summary: context.scopeHighlights.join(", ")
  };
}

const langfuse = new LangfuseClient();

// Fetch the active prompt version from Langfuse. Same signature as
// the local-compile version from the previous checkpoint — different
// source.
async function getPrompt() {
  return await langfuse.prompt.get(env.langfusePromptName);
}

function toOpenAIMessages(
  messages: ChatMessage[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

function readAssistantText(message: OpenAI.Chat.Completions.ChatCompletionMessage) {
  if (typeof message.content === "string") {
    return message.content.trim();
  }
  return "";
}

function parseToolArguments(argumentsText: string) {
  try {
    const parsed = JSON.parse(argumentsText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return null;
  }
}

async function runSupportConversationInner(request: ChatRequest): Promise<ChatResponse> {
  const context = getSupportContext();
  const langfusePrompt = await getPrompt();
  const systemPrompt = langfusePrompt.compile(buildPromptVariables(context));
  const userId = request.userId ?? `workshop-${context.id}`;

  return propagateAttributes(
    {
      userId,
      sessionId: request.sessionId,
      traceName: "dad-it-support-chat-turn",
      tags: ["langfuse-workshop", "dad-it-support"]
    },
    async () => {
      const openai = observeOpenAI(
        new OpenAI({ apiKey: env.openaiApiKey }),
        { langfusePrompt }
      );

      const transcript: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
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
          if (toolCall.type !== "function") continue;
          usedTools.add(toolCall.function.name);
          const parsedArguments = parseToolArguments(toolCall.function.arguments);
          const result =
            parsedArguments === null
              ? { ok: false, error: `The tool arguments for ${toolCall.function.name} were not valid JSON.` }
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
        usedTools: [...usedTools],
        traceMeta: {
          contextId: context.id,
          contextLabel: context.label,
          model: env.openaiModel
        }
      };
    }
  );
}

export const runSupportConversation = observe(runSupportConversationInner, {
  name: "dad-it-support-chat-turn",
  asType: "agent"
});
