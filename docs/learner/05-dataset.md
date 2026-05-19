# 05 Dataset

## Starting point

You already understand the app scope and the kinds of production behavior you want to inspect.

## Goal

Create a starter dataset that reflects the intended scope of the Dad IT Support Agent.

## What you need to do

1. Pick 20 to 30 representative examples.
2. Store the dataset input in the same message-array shape the app already uses.
3. Add an expected output for each item.
4. Add a dataset seed script that uploads the items to Langfuse.

## Files you are expected to change

- `data/seed-dataset.json`
- `scripts/seed-dataset.ts`

## How to verify you are done

- The dataset includes both normal in-scope questions and a few edge cases.
- Each item has `input.messages`.
- Each item has an `expectedOutput`.
- The seed script creates or updates the dataset in Langfuse.

## End state

This finished dataset becomes the starting point for `06-experiments`.
