import "../src/server/load-env";

import { randomUUID } from "node:crypto";
import { LangfuseClient } from "@langfuse/client";
import type { MapValue, ObservationLevel } from "@langfuse/core";
import { env } from "../src/server/env";
import {
  DEFAULT_TRACE_SEED_TAG,
  TraceSeedObservation,
  TraceSeedScore,
  TraceSeedSnapshot,
  TraceSeedTraceBundle,
  chunkIngestionBatch,
  countBy,
  defaultTraceSeedPath,
  hasFlag,
  orderObservationsParentFirst,
  readStringFlag,
  readTraceSeedSnapshot,
  withSeedSourcePromptMetadata
} from "./langfuse-trace-seed-lib";

type SeedIngestionEvent = Parameters<LangfuseClient["api"]["ingestion"]["batch"]>[0]["batch"][number];

async function main() {
  const inputPath = readStringFlag("--input") ?? defaultTraceSeedPath(import.meta.url);
  const dryRun = hasFlag("--dry-run");

  const snapshot = await readTraceSeedSnapshot(inputPath);
  validateSnapshot(snapshot, inputPath);

  const events = buildIngestionEvents(snapshot);
  const batches = chunkIngestionBatch(events);
  const eventSummaryById = new Map(events.map((event) => [event.id, summarizeEvent(event)]));

  console.log(
    `Prepared ${events.length} ingestion events across ${batches.length} batches ` +
      `for ${snapshot.summary.exportedTraces} traces.`
  );
  console.log(`Event counts: ${JSON.stringify(countBy(events.map((event) => event.type)), null, 2)}`);

  if (dryRun) {
    console.log(`Dry run only. No data was imported from ${inputPath}.`);
    return;
  }

  const targetPublicKey =
    process.env.LANGFUSE_TARGET_PUBLIC_KEY ?? process.env.LANGFUSE_PUBLIC_KEY ?? "";
  const targetSecretKey =
    process.env.LANGFUSE_TARGET_SECRET_KEY ?? process.env.LANGFUSE_SECRET_KEY ?? "";
  const targetBaseUrl = process.env.LANGFUSE_TARGET_BASE_URL ?? env.langfuseBaseUrl;

  if (!targetPublicKey || !targetSecretKey) {
    throw new Error(
      "Import requires Langfuse credentials. Set LANGFUSE_TARGET_PUBLIC_KEY and LANGFUSE_TARGET_SECRET_KEY, or rely on LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY as a fallback."
    );
  }

  const usingFallbackCredentials =
    !process.env.LANGFUSE_TARGET_PUBLIC_KEY && !process.env.LANGFUSE_TARGET_SECRET_KEY;
  if (usingFallbackCredentials) {
    console.log("LANGFUSE_TARGET_* not set. Falling back to LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY.");
  }

  const langfuse = new LangfuseClient({
    publicKey: targetPublicKey,
    secretKey: targetSecretKey,
    baseUrl: targetBaseUrl
  });

  for (const [index, batch] of batches.entries()) {
    console.log(`Importing batch ${index + 1}/${batches.length} (${batch.length} events)...`);
    const response = await langfuse.api.ingestion.batch({ batch });

    if (response.errors.length > 0) {
      const details = response.errors
        .map((error) => {
          const summary = eventSummaryById.get(error.id);
          const label = summary ? `${error.id} (${summary})` : error.id;
          return `- ${label}: ${error.message ?? JSON.stringify(error.error ?? null)}`;
        })
        .join("\n");
      throw new Error(`Langfuse import failed with ${response.errors.length} ingestion errors:\n${details}`);
    }
  }

  console.log(`Imported ${snapshot.summary.exportedTraces} traces into ${targetBaseUrl}.`);
}

function validateSnapshot(snapshot: TraceSeedSnapshot, inputPath: string) {
  if (snapshot.schemaVersion !== 1) {
    throw new Error(
      `Unsupported trace seed schema version ${snapshot.schemaVersion} in ${inputPath}. Expected version 1.`
    );
  }
}

function buildIngestionEvents(snapshot: TraceSeedSnapshot) {
  const traceEvents = snapshot.traces.map((bundle) => buildTraceCreateEvent(bundle));
  const observationEvents = snapshot.traces.flatMap((bundle) =>
    orderObservationsParentFirst(bundle.observations).map((observation) =>
      buildObservationIngestionEvent(bundle, observation)
    )
  );
  const scoreEvents = snapshot.traces.flatMap((bundle) =>
    bundle.scores.map((score) => buildScoreCreateEvent(score))
  );

  return [...traceEvents, ...observationEvents, ...scoreEvents];
}

function buildTraceCreateEvent(bundle: TraceSeedTraceBundle): SeedIngestionEvent {
  const tags = bundle.trace.tags.includes(DEFAULT_TRACE_SEED_TAG)
    ? bundle.trace.tags
    : [...bundle.trace.tags, DEFAULT_TRACE_SEED_TAG];

  return {
    type: "trace-create",
    id: randomUUID(),
    timestamp: bundle.trace.timestamp,
    body: {
      id: bundle.trace.id,
      timestamp: bundle.trace.timestamp,
      name: bundle.trace.name ?? undefined,
      userId: bundle.trace.userId ?? undefined,
      input: bundle.trace.input,
      output: bundle.trace.output,
      sessionId: bundle.trace.sessionId ?? undefined,
      release: bundle.trace.release ?? undefined,
      version: bundle.trace.version ?? undefined,
      metadata: bundle.trace.metadata,
      tags,
      environment: bundle.trace.environment,
      public: false
    }
  };
}

function buildObservationIngestionEvent(
  bundle: TraceSeedTraceBundle,
  observation: TraceSeedObservation
): SeedIngestionEvent {
  const metadata = withImportedObservationMetadata(observation);
  const level = observation.level as ObservationLevel;
  const commonBody = {
    id: observation.id,
    traceId: bundle.trace.id,
    name: observation.name ?? undefined,
    startTime: observation.startTime,
    endTime: observation.endTime ?? undefined,
    input: observation.input,
    output: observation.output,
    metadata,
    level,
    statusMessage: observation.statusMessage ?? undefined,
    parentObservationId: observation.parentObservationId ?? undefined,
    version: observation.version ?? undefined,
    environment: observation.environment || bundle.trace.environment
  };

  if (observation.type === "GENERATION") {
    return {
      type: "generation-create",
      id: randomUUID(),
      timestamp: observation.startTime,
      body: {
        ...commonBody,
        completionStartTime: observation.completionStartTime ?? undefined,
        model: observation.model ?? undefined,
        modelParameters: asPlainRecord(observation.modelParameters),
        usage: toLegacyUsage(observation.usageDetails),
        usageDetails: observation.usageDetails,
        costDetails: observation.costDetails
      }
    };
  }

  if (observation.type === "EVENT") {
    return {
      type: "event-create",
      id: randomUUID(),
      timestamp: observation.startTime,
      body: {
        id: observation.id,
        traceId: bundle.trace.id,
        name: observation.name ?? undefined,
        startTime: observation.startTime,
        metadata,
        input: observation.input,
        output: observation.output,
        level,
        statusMessage: observation.statusMessage ?? undefined,
        parentObservationId: observation.parentObservationId ?? undefined,
        version: observation.version ?? undefined,
        environment: observation.environment || bundle.trace.environment
      }
    };
  }

  return {
    type: "span-create",
    id: randomUUID(),
    timestamp: observation.startTime,
    body: {
      id: observation.id,
      traceId: bundle.trace.id,
      name: observation.name ?? undefined,
      startTime: observation.startTime,
      endTime: observation.endTime ?? undefined,
      metadata,
      input: observation.input,
      output: observation.output,
      level,
      statusMessage: observation.statusMessage ?? undefined,
      parentObservationId: observation.parentObservationId ?? undefined,
      version: observation.version ?? undefined,
      environment: observation.environment || bundle.trace.environment
    }
  };
}

function buildScoreCreateEvent(score: TraceSeedScore): SeedIngestionEvent {
  return {
    type: "score-create",
    id: randomUUID(),
    timestamp: score.timestamp,
    body: {
      id: score.id,
      traceId: score.traceId,
      observationId: score.observationId ?? undefined,
      name: score.name,
      value: score.value,
      comment: score.comment ?? undefined,
      metadata: score.metadata,
      dataType: score.dataType,
      environment: score.environment
    }
  };
}

function toLegacyUsage(usageDetails: Record<string, number> | undefined) {
  if (!usageDetails) return undefined;

  const input =
    usageDetails.input ??
    usageDetails.input_tokens ??
    usageDetails.prompt_tokens;
  const output =
    usageDetails.output ??
    usageDetails.output_tokens ??
    usageDetails.completion_tokens;

  if (typeof input !== "number" || typeof output !== "number") {
    return undefined;
  }

  return {
    input,
    output,
    total: usageDetails.total ?? usageDetails.total_tokens ?? input + output,
    unit: null
  };
}

function withImportedObservationMetadata(observation: TraceSeedObservation) {
  const metadata = withSeedSourcePromptMetadata(observation.metadata, observation.prompt);
  const seedSourceObservation = buildSeedSourceObservationMetadata(observation);

  if (!seedSourceObservation) {
    return metadata;
  }

  if (isPlainRecord(metadata)) {
    return {
      ...metadata,
      seedSourceObservation
    };
  }

  return {
    seedSourceObservation,
    sourceMetadata: metadata ?? null
  };
}

function buildSeedSourceObservationMetadata(observation: TraceSeedObservation) {
  const details: Record<string, unknown> = {};

  if (observation.type !== "SPAN") {
    details.type = observation.type;
  }

  if (observation.completionStartTime) {
    details.completionStartTime = observation.completionStartTime;
  }

  if (observation.model) {
    details.model = observation.model;
  }

  const modelParameters = asPlainRecord(observation.modelParameters);
  if (modelParameters) {
    details.modelParameters = modelParameters;
  }

  if (observation.usageDetails) {
    details.usageDetails = observation.usageDetails;
  }

  if (observation.costDetails) {
    details.costDetails = observation.costDetails;
  }

  return Object.keys(details).length > 0 ? details : undefined;
}

function summarizeEvent(event: SeedIngestionEvent) {
  const body = event.body as Record<string, unknown>;
  const bodyId = typeof body.id === "string" ? body.id : "unknown";
  const name = typeof body.name === "string" ? body.name : undefined;
  const traceId = typeof body.traceId === "string" ? body.traceId : undefined;

  return [event.type, bodyId, name, traceId].filter(Boolean).join(" | ");
}

function asPlainRecord(value: unknown) {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  return value as Record<string, MapValue>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

void main();
