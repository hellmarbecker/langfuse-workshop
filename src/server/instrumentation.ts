import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { env, isLangfuseConfigured } from "./env";

let sdk: NodeSDK | null = null;

export function ensureTracingInitialized() {
  if (!isLangfuseConfigured() || sdk) {
    return sdk;
  }

  sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey: env.langfusePublicKey,
        secretKey: env.langfuseSecretKey,
        baseUrl: env.langfuseBaseUrl,
        environment: process.env.NODE_ENV ?? "development"
      })
    ]
  });

  sdk.start();
  return sdk;
}

export async function shutdownTracing() {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = null;
}

