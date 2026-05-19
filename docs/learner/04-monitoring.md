# 04 Monitoring

## Starting point

You have the traced app, and ideally the prompt-management step is also in place.

## Goal

Define the first production signals you want to monitor and map them from the observation shape created in tracing.

## What you need to do

1. Decide which behaviors are high-signal for this app.
2. Start with:
   - out-of-scope requests
   - user disagreement
3. Target the `dad-it-support-chat-turn` agent observation.
4. Use the message-array trace input rather than custom one-off fields.
5. Map the variables you need in Langfuse, for example:
   - `messages` from `$.messages`
   - `system_prompt` from `$.messages[0].content`
   - `assistant_output` from `$.answer`

## Files you are expected to change

- usually docs and Langfuse UI configuration, not much app code
- `docs/04-monitoring.md`

## How to verify you are done

- You can point to one clear observation target for the monitors.
- You know which JSON paths to use for the monitoring variables.
- You can demo one out-of-scope request and one disagreement example.

## End state

This finished understanding becomes the starting point for `05-dataset`.
