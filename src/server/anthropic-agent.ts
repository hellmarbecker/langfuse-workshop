import Anthropic from "@anthropic-ai/sdk";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";
import type { ChatMessage, ChatRequest, ChatResponse } from "../shared/types";
import { env } from "./env";
import { resolveSupportPrompt } from "./prompt-manager";
import { getProfileById } from "./support-data";
import { TOOL_DEFINITIONS, executeTool } from "./tools";

const anthropic = new Anthropic({
  apiKey: env.anthropicApiKey || undefined
});

function toAnthropicMessages(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

function getLastUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function readTextBlocks(blocks: Array<{ type: string; text?: string }>) {
  return blocks
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n\n")
    .trim();
}

export async function runSupportConversation(
  request: ChatRequest
): Promise<{ span: unknown; result: ChatResponse }> {
  if (!env.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is missing.");
  }

  const profile = getProfileById(request.profileId);

  if (!profile) {
    throw new Error(`Unknown profile: ${request.profileId}`);
  }

  return startActiveObservation(
    "parent-support-chat-turn",
    async (agentSpan) => {
      return propagateAttributes(
        {
          userId: request.userId ?? `workshop-${profile.id}`,
          sessionId: request.sessionId,
          traceName: "parent-support-chat-turn",
          tags: ["langfuse-workshop", "parent-support"],
          version: "0.1.0",
          metadata: {
            profileId: profile.id,
            profileLabel: profile.label,
            profileDevice: profile.primaryDevice
          }
        },
        async () => {
          const prompt = await resolveSupportPrompt(profile);
          const transcript = toAnthropicMessages(request.messages);
          const usedTools = new Set<string>();

          agentSpan.update({
            input: {
              profileId: profile.id,
              profileLabel: profile.label,
              systemPrompt: prompt.promptText,
              promptSource: prompt.promptSource,
              conversationHistory: request.messages,
              lastUserMessage: getLastUserMessage(request.messages)
            }
          });

          let finalAnswer = "";

          for (let attempt = 0; attempt < 4; attempt += 1) {
            const generation = agentSpan.startObservation(
              "anthropic-message",
              {
                model: env.anthropicModel,
                input: {
                  system: prompt.promptText,
                  messages: transcript,
                  tools: TOOL_DEFINITIONS
                }
              },
              { asType: "generation" }
            );

            if (prompt.linkedPrompt) {
              generation.update({ prompt: prompt.linkedPrompt });
            }

            const response = await anthropic.messages.create({
              model: env.anthropicModel,
              max_tokens: 700,
              temperature: 0.2,
              system: prompt.promptText,
              messages: transcript,
              tools: TOOL_DEFINITIONS
            });

            generation.update({
              output: response.content,
              usageDetails: {
                input: response.usage.input_tokens,
                output: response.usage.output_tokens
              },
              metadata: {
                stopReason: response.stop_reason ?? null,
                promptSource: prompt.promptSource
              }
            });
            generation.end();

            transcript.push({
              role: "assistant",
              content: response.content as unknown as string
            });

            const toolUses = response.content.filter((block) => block.type === "tool_use");

            if (toolUses.length === 0) {
              finalAnswer = readTextBlocks(response.content);
              break;
            }

            const toolResults = [];

            for (const toolUse of toolUses) {
              usedTools.add(toolUse.name);

              const toolSpan = agentSpan.startObservation(
                toolUse.name,
                {
                  input: toolUse.input as Record<string, unknown>
                },
                { asType: "tool" }
              );

              const result = await executeTool(
                toolUse.name,
                toolUse.input as Record<string, unknown>
              );

              toolSpan.update({ output: result });
              toolSpan.end();

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify(result, null, 2)
              });
            }

            transcript.push({
              role: "user",
              content: toolResults as unknown as string
            });
          }

          if (!finalAnswer) {
            finalAnswer =
              "I ran out of room before finishing that answer. Please ask the question once more in a slightly shorter way.";
          }

          agentSpan.update({
            output: {
              answer: finalAnswer,
              promptSource: prompt.promptSource,
              usedTools: [...usedTools]
            }
          });

          return {
            span: agentSpan,
            result: {
              answer: finalAnswer,
              promptSource: prompt.promptSource,
              usedTools: [...usedTools],
              traceMeta: {
                profileId: profile.id,
                profileLabel: profile.label,
                model: env.anthropicModel
              }
            }
          };
        }
      );
    },
    { asType: "agent" }
  );
}

