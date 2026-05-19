import { LangfuseClient } from "@langfuse/client";
import { env, isLangfuseConfigured } from "./env";
import {
  buildPromptVariables,
  compileLocalPrompt,
  getLocalPromptTemplate,
  type PromptVariant
} from "./local-prompt";
import type { SupportContext } from "../shared/types";

let langfuseClient: LangfuseClient | null = null;

function getLangfuseClient() {
  if (!isLangfuseConfigured()) {
    return null;
  }

  if (!langfuseClient) {
    langfuseClient = new LangfuseClient({
      publicKey: env.langfusePublicKey,
      secretKey: env.langfuseSecretKey,
      baseUrl: env.langfuseBaseUrl
    });
  }

  return langfuseClient;
}

export type ResolvedPrompt = {
  promptText: string;
  promptSource: "local" | "langfuse";
  linkedPrompt?: {
    name: string;
    version: number;
    isFallback: boolean;
  };
  langfusePrompt?: unknown;
  variant: PromptVariant;
};

export async function resolveSupportPrompt(context: SupportContext): Promise<ResolvedPrompt> {
  const variant = (env.workshopPromptVariant as PromptVariant) || "baseline";
  const fallback = getLocalPromptTemplate(variant);
  const variables = buildPromptVariables(context);
  const langfuse = getLangfuseClient();

  if (!langfuse || !env.langfusePromptName) {
    return {
      promptText: compileLocalPrompt(fallback, variables),
      promptSource: "local",
      variant
    };
  }

  const prompt = await langfuse.prompt.get(env.langfusePromptName, {
    type: "text",
    label: env.langfusePromptLabel || undefined,
    fallback,
    cacheTtlSeconds: process.env.NODE_ENV === "development" ? 0 : 60
  });

  return {
    promptText: prompt.compile(variables),
    promptSource: prompt.isFallback ? "local" : "langfuse",
    linkedPrompt: {
      name: prompt.name,
      version: prompt.version,
      isFallback: prompt.isFallback
    },
    langfusePrompt: prompt,
    variant
  };
}

export async function publishSupportPrompt(variant: PromptVariant) {
  const langfuse = getLangfuseClient();

  if (!langfuse) {
    throw new Error("Langfuse credentials are required to publish prompts.");
  }

  const name = env.langfusePromptName || "dad-it-support-agent";
  const label = env.langfusePromptLabel || "production";

  await langfuse.prompt.create({
    name,
    type: "text",
    prompt: getLocalPromptTemplate(variant),
    labels: [label]
  });

  return { name, label, variant };
}
