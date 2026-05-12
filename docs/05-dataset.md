# 05 Dataset

Once monitoring has surfaced interesting production behavior, the next step is to seed a representative test set.

## Dataset in this repo

The starter dataset lives in:

- `data/seed-dataset.json`

It covers:

- iPhone, Windows, and Android device help
- in-scope requests
- adjacent-scope requests
- clearly out-of-scope requests
- a few ambiguity and limitation cases

## Seed it into Langfuse

```bash
npm run dataset:seed
```

This uses:

- `scripts/seed-dataset.ts`

## Dataset item shape

Each item contains:

- `input.profileId`
- `input.message`
- `expectedOutput.idealAnswer`
- `expectedOutput.expectedKeywords`
- metadata for category and scope

## Why expected keywords are included

They enable a tiny deterministic score in code without replacing the real evaluator story. This is helpful for showing that:

- manual scores are possible
- LLM-as-a-judge is not the only evaluation option

## Teaching point

The dataset is not supposed to be perfect. It is supposed to be representative enough to start comparing runs in a disciplined way.

