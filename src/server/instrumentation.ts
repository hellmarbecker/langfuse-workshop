import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { env, isLangfuseConfigured } from "./env";

let sdk: NodeSDK | null = null;
export let langfuseSpanProcessor: LangfuseSpanProcessor | null = null;

export function ensureTracingInitialized() {
  if (!isLangfuseConfigured() || sdk) {
    return sdk;
  }

  langfuseSpanProcessor = new LangfuseSpanProcessor({
    publicKey: env.langfusePublicKey,
    secretKey: env.langfuseSecretKey,
    baseUrl: env.langfuseBaseUrl,
    environment: process.env.NODE_ENV ?? "development"
  });

  sdk = new NodeSDK({
    spanProcessors: [langfuseSpanProcessor]
  });

  sdk.start();
  return sdk;
}

export async function flushTracing() {
  if (!langfuseSpanProcessor) {
    return;
  }

  await langfuseSpanProcessor.forceFlush();
}

export async function shutdownTracing() {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = null;
  langfuseSpanProcessor = null;
}
