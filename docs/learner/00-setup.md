# 00 Setup

## Starting point

An untouched workshop repo.

## Goal

Be ready to run the app locally and connect it to OpenAI and Langfuse Cloud EU.

## What you need to do

1. Copy `.env.example` to `.env`.
2. Add your `OPENAI_API_KEY`.
3. Add your Langfuse keys and confirm `LANGFUSE_BASE_URL` is `https://cloud.langfuse.com`.
4. Install dependencies with `npm install`.
5. Run `npm run dev`.
6. Open the app in the browser.

## Files you are expected to touch

- `.env`

## How to verify you are done

- The server starts.
- The web chat opens.
- The app loads without setup errors.

## End state

You are ready to start from `checkpoint/01-base-app`.
