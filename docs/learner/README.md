# Learner path

This folder is the participant-facing version of the workshop.

Each module is written as a build step:

1. Start from the previous checkpoint.
2. Add the missing parts yourself.
3. Use the finished state as the input to the next step.

That means:

- `01-base-app` is the first runnable app.
- `02-tracing` starts from the untraced app and ends with the traced app.
- `03-prompt-management` starts from the traced app.
- `04-monitoring` starts from the traced and prompt-managed shape.
- later steps keep following the same pattern.

Modules:

- [00 Setup](./00-setup.md)
- [01 Base App](./01-base-app.md)
- [02 Tracing](./02-tracing.md)
- [03 Prompt Management](./03-prompt-management.md)
- [04 Monitoring](./04-monitoring.md)
- [05 Dataset](./05-dataset.md)
- [06 Experiments](./06-experiments.md)
- [07 Prompt Iteration](./07-prompt-iteration.md)
- [08 Wrap-up](./08-wrap-up.md)
