import Anthropic from "@anthropic-ai/sdk";
import { observe, propagateAttributes, startObservation } from "@langfuse/tracing";
import { LangfuseClient } from "@langfuse/client";
import type { ChatMessage, ChatRequest, ChatResponse } from "../shared/types";
import { env } from "./env";
import { getSupportContext } from "./support-data";
import { TOOL_DEFINITIONS, executeTool } from "./tools";

// Local fallback used when Langfuse isn't reachable or the prompt
// isn't published yet. scripts/publish-prompt.ts pushes this same
// string up to Langfuse.
export const SYSTEM_PROMPT = `You are Dad IT Support Agent.
You are talking directly to Dad. He opened this chat himself to get help with his iPhone.

You do not yet know which iPhone Dad has or which apps he uses — call get_support_context to find out before giving any device-specific instructions.

Rules:
- Speak directly to Dad in second person ("you", "your iPhone"). Never refer to Dad in the third person.
- Call get_support_context as your very first tool call on each turn so you know which iPhone, iOS, and apps Dad has.
- For step-by-step help, call search_help_library before giving the final answer.
- Use short numbered steps with one action per line.
- Mention what Dad should expect to see on his screen after important taps.
- Be honest about limits. You cannot see his screen, passwords, or real-time location.
- If the request is out of scope, say so kindly and redirect to the closest iPhone-help you can give.
- Do not invent button names or settings paths that were not confirmed by tool results.
`;

const langfuse = new LangfuseClient();

async function getPrompt() {
  try { return await langfuse.prompt.get(env.langfusePromptName); }
  catch { return null; }
}

function toAnthropicMessages(
  messages: ChatMessage[]
): Anthropic.MessageParam[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

function readAssistantText(message: Anthropic.Message) {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

async function runSupportConversationInner(request: ChatRequest): Promise<ChatResponse> {
  const context = getSupportContext();
  const langfusePrompt = await getPrompt();
  const systemPrompt =
    typeof langfusePrompt?.prompt === "string" ? langfusePrompt.prompt : SYSTEM_PROMPT;
  const userId = request.userId ?? `workshop-${context.id}`;

  return propagateAttributes(
    {
      userId,
      sessionId: request.sessionId,
      traceName: "dad-it-support-chat-turn",
      tags: ["langfuse-workshop", "dad-it-support"]
    },
    async () => {
      const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

      const transcript: Anthropic.MessageParam[] = toAnthropicMessages(request.messages);
      const usedTools = new Set<string>();
      let finalAnswer = "";

      for (let attempt = 0; attempt < 6; attempt += 1) {
        // The Anthropic SDK has no Langfuse auto-instrumentation wrapper, so we
        // open a generation observation by hand around each Messages API call.
        // observe(...) on the agent and tools still nests these underneath.
        const generation = startObservation(
          "dad-it-support-generation",
          {
            model: env.anthropicModel,
            input: { system: systemPrompt, messages: transcript },
            modelParameters: { max_tokens: 1024 },
            prompt: langfusePrompt
              ? {
                  name: langfusePrompt.name,
                  version: langfusePrompt.version,
                  isFallback: langfusePrompt.isFallback
                }
              : undefined
          },
          { asType: "generation" }
        );

        let response: Anthropic.Message;
        try {
          response = await anthropic.messages.create({
            model: env.anthropicModel,
            max_tokens: 1024,
            system: systemPrompt,
            tools: TOOL_DEFINITIONS,
            messages: transcript
          });
        } catch (error) {
          generation.update({
            level: "ERROR",
            statusMessage: error instanceof Error ? error.message : String(error)
          });
          generation.end();
          throw error;
        }

        generation.update({
          output: response.content,
          usageDetails: {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens
          }
        });
        generation.end();

        transcript.push({ role: "assistant", content: response.content });

        const toolUses = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
        );
        if (toolUses.length === 0) {
          finalAnswer = readAssistantText(response);
          break;
        }

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUses) {
          usedTools.add(toolUse.name);
          const input =
            toolUse.input && typeof toolUse.input === "object"
              ? (toolUse.input as Record<string, unknown>)
              : {};
          const result = await executeTool(toolUse.name, input);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result)
          });
        }
        transcript.push({ role: "user", content: toolResults });
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
          model: env.anthropicModel
        }
      };
    }
  );
}

export const runSupportConversation = observe(runSupportConversationInner, {
  name: "dad-it-support-chat-turn",
  asType: "agent"
});
