# 04 Monitoring

## How to think about this step

Tracing helps us understand one request. Monitoring helps us notice the requests that deserve attention. The point is not to score everything. The point is to catch the kinds of events that help us decide what to improve next.

## Scope of the sample app

In scope:

- practical help with Dad's known devices
- Bluetooth, Wi-Fi, photos, maps, printing, and simple laptop tasks

Out of scope:

- taxes
- travel booking on Dad's behalf
- anything that requires live account access, passwords, or live location

## Suggested first two monitors

- Out-of-scope request
- User disagreement

These are both high-signal and easy to explain live.

## Recommended evaluator target

Use an observation-level evaluator on:

- observation type: `agent`
- observation name: `dad-it-support-chat-turn`

## Stable fields in this repo

The root observation input contains:

- `messages`
- `promptSource`
- `supportContext`

The root observation output contains:

- `answer`
- `promptSource`
- `usedTools`
- `model`

## Useful mappings

Base everything on the `messages` array:

- `messages` -> `$.messages`
- `system_prompt` -> `$.messages[0].content`
- `assistant_output` -> `$.answer`
- optional `support_context` -> `$.supportContext`

For disagreement detection, the simplest workshop version is:

- pass the full `messages` array
- pass the final `answer`

That avoids brittle “last user message” mappings and keeps the evaluator logic grounded in the whole conversation.

## Demo suggestion

1. Ask a clearly out-of-scope question such as:
   - “Can you file my taxes for me?”
2. Ask a question, get an answer, then disagree:
   - “No, that menu is not there.”
3. Show how those traces become review candidates in Langfuse.

## Teaching point

Monitoring is the bridge from production traffic to future datasets and experiments.
