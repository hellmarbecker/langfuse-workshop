# 00 Setup

## How to think about this step

This step is about making the rest of the workshop frictionless. We are not teaching Langfuse features yet. We are removing setup surprises so the workshop time can go into tracing, monitoring, and experiments.

## Goal

Make sure participants can:

- run the app locally
- call the OpenAI API
- connect to Langfuse Cloud EU
- use the Langfuse CLI and Langfuse skill later in the workshop

## What to prepare

- An OpenAI API key
- A Langfuse project on the EU cloud region
- Langfuse public and secret keys
- Node.js and npm

## Environment variables

Use `.env.example` as the template:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini

LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
LANGFUSE_PROMPT_NAME=dad-it-support-agent
LANGFUSE_PROMPT_LABEL=production

WORKSHOP_PROMPT_VARIANT=baseline
DATASET_NAME=dad-it-support-workshop
```

## Commands

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3333](http://127.0.0.1:3333).

## Langfuse-specific prep

- Ask participants to install the Langfuse CLI.
- Ask participants to install the Langfuse skill if that is part of the workshop environment.
- Point out that Langfuse credentials are optional for the earliest app step but required for tracing, prompts, datasets, and experiments.

## Teaching note

Call out that the workshop starts with a working OpenAI app first. Langfuse is added deliberately in later steps so participants can feel what each layer changes.
