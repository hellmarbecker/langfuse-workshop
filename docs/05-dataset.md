# 05 Dataset

## How to think about this step

This step turns interesting product scope into reusable test cases. A dataset is our first move from “I noticed something in production” to “I can test this repeatedly.”

## Goal

Seed an initial dataset that reflects the real scope of the Dad IT Support Agent.

## Dataset shape in this repo

Each item uses:

- `input.messages`
- `expectedOutput.idealAnswer`
- `expectedOutput.expectedKeywords`

This keeps the experiment input close to the same message-array shape the app already uses in production traces.

## Files to point at

- `data/seed-dataset.json`
- `scripts/seed-dataset.ts`

## Seed command

```bash
npm run dataset:seed
```

## What the starter dataset should cover

- iPhone Bluetooth
- iPhone Wi-Fi
- photos and WhatsApp
- Maps basics
- Windows Wi-Fi
- printing and downloads
- out-of-scope requests
- limitation cases such as passwords or live location

## Teaching point

The dataset is not “all possible requests.” It is a first representative slice of the app’s intended scope and failure modes.
