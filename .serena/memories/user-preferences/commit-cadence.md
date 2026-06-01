# Commit cadence preference

The user wants git commits made **during** implementation — one per logical chunk of work — not batched into a single end-of-task commit.

**Why:** Stated at the start of implementing the telemetry-dashboard plan. They want reviewable history as work proceeds; they followed up by pushing to the remote at natural breakpoints (after the proxy was complete, when wiring deploys, etc.) so the commit boundaries match how they'd review.

**How to apply:**
- When working through a multi-step plan, commit at each logical step (per file group, per feature, per fix).
- Use conventional terse commit subjects (`feat(proxy): …`, `fix(site): …`, `ci: …`, `docs: …`, `refactor: …`, `test: …`); commit bodies describe the *why*, especially when the change isn't obvious from the diff.
- All commits in this repo use the Co-Authored-By trailer for the assisting model.
- Pushing to `origin/main` triggers production deploys (proxy and/or site workflows). The user is comfortable with pushes during implementation work since deploys are idempotent, but match the granularity of pushes to natural "this is ready to be visible" moments rather than every commit. Confirm before pushing if the change is risky or might surprise.
