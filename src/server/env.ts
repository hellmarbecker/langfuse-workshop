import "./load-env";

export const env = {
  port: Number(process.env.PORT ?? 8787),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
  langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY ?? "",
  langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY ?? "",
  langfuseBaseUrl: process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
  langfusePromptName: process.env.LANGFUSE_PROMPT_NAME ?? "dad-it-support-agent",
  langfusePromptLabel: process.env.LANGFUSE_PROMPT_LABEL ?? "production",
  workshopPromptVariant: process.env.WORKSHOP_PROMPT_VARIANT ?? "default",
  datasetName: process.env.DATASET_NAME ?? "dad-it-support-workshop"
};

export function isLangfuseConfigured() {
  return Boolean(env.langfusePublicKey && env.langfuseSecretKey);
}
