## Description
Please include a summary of the changes and the related issue. Please also include relevant motivation and context.

Fixes # (issue)

## Architecture Compliance Verification
By submitting this pull request, you verify that your changes adhere to Neural Arena's core invariants:

- [ ] **Deterministic Runtime**: All simulation state changes are strictly derived from the `EventBus`/`EventStore` transaction stream. No side effects or untracked state mutations are introduced.
- [ ] **Replay Integrity**: Replaying a generated log from cursor `0` to `N` via `replayToIndex` reconstructs the identical visual and structural dashboard state.
- [ ] **Causal Chain Alignment**: All new events include appropriate `causedByEventId` links where causal relationships exist.
- [ ] **Domain Agnosticism**: Core engine systems remain completely decoupled from specific simulation rules (e.g. Chess rules).

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update (no code changes)

## How Has This Been Tested?
Please describe the tests that you ran to verify your changes:

```bash
# Verify TypeScript compilation and linting
npx tsc --noEmit

# Verify dashboard building
npm run dashboard:build
```

- [ ] **Manual Replay Verification**: Exported a simulation session, cleared cache, imported the `.neural-arena.json` trace, and verified tick-by-tick state reconstruction matched the original run.
- [ ] **Platform Parity**: Verified functionality under both Web and Electron runtimes.
- [ ] **Diagnostics Integrity**: Checked that the Telemetry and Diagnostics panels report accurate metrics for the new workflows.
