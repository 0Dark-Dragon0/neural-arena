# GitHub Templates and CI Build Verification Guide

To maintain structural health, type safety, and architectural invariants across all contributions, Neural Arena utilizes a suite of GitHub Issue templates, a structured Pull Request contract, and a robust Windows-latest GitHub Actions CI workflow.

This document details the configuration and contains copyable blocks of these template files.

---

## 1. Automated CI Build Workflow (`build.yml`)

The integration pipeline automatically validates pushes and pull requests to `main` and `dev` branches. Given that Neural Arena is optimized for Windows-first Electron packaging, the CI runner runs on `windows-latest`.

### YAML Source (`.github/workflows/build.yml`)
```yaml
name: CI Build Verification

on:
  push:
    branches: [ main, dev ]
  pull_request:
    branches: [ main, dev ]

jobs:
  build:
    name: Compile and Verify Build
    runs-on: windows-latest

    steps:
    - name: Checkout Repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'

    - name: Install Dependencies
      run: npm install

    - name: TypeScript Type Check
      run: npx tsc --noEmit

    - name: Build Web Dashboard
      run: npm run dashboard:build

    - name: Compile Backend & Dashboard Bundles
      run: npm run build:release

    - name: Validate Electron Package Assembly
      run: npx electron-builder --dir --win
```

### Build Steps Explained
1. **Checkout Repository**: Pulls down the git tree using `actions/checkout@v4`.
2. **Setup Node.js**: Registers the Node runtime using version `20.x`. Caches the global npm cache index to optimize step speeds on repeat builds.
3. **Install Dependencies**: Installs workspace libraries.
4. **TypeScript Type Check**: Runs `tsc --noEmit`. Any implicit casts, type compiler warnings, or unresolved imports fail the build immediately.
5. **Build Web Dashboard**: Compiles the React/Vite assets into `dist-dashboard/`.
6. **Compile Backend**: Assembles the core engine and utilities into `dist/`.
7. **Validate Electron Assembly**: Runs a dry package build (`electron-builder --dir --win`) to verify installer files and binary dependencies compile cleanly on Windows without code signing errors.

---

## 2. Bug Report Template (`bug_report.md`)

Located in `.github/ISSUE_TEMPLATE/bug_report.md`, this template forces contributors to provide environment context and event traces when reporting issues:

### Markdown Source
```markdown
---
name: Bug Report
about: Create a report to help us improve Neural Arena
title: '[BUG] '
labels: bug, triage
assignees: ''
---

## Description
A clear and concise description of what the bug is.

## Steps to Reproduce
Steps to reproduce the behavior:
1. Run command '...'
2. Open dashboard on '...'
3. Click on '...'
4. See error

## Expected Behavior
A clear and concise description of what you expected to happen.

## Simulation Logs / Event Traces
If applicable, please attach the `.neural-arena.json` replay trace or the relevant terminal log output around the time of the error.

## Context & Environment
- **Neural Arena Version**: [e.g., 1.0.0-alpha.1]
- **Deployment Platform**: [e.g., Electron / Browser (Chrome/Firefox)]
- **OS**: [e.g., Windows 11, macOS Sequoia, Ubuntu 24.04]
- **Node.js Version**: [e.g., v20.11.0]

## Additional Context
Add any other context about the problem here (e.g., model provider, model families used, setup presets).
```

---

## 3. Feature Request Template (`feature_request.md`)

Located in `.github/ISSUE_TEMPLATE/feature_request.md`, this template asks contributors to detail how the proposed enhancements align with the event-sourced architecture.

### Markdown Source
```markdown
---
name: Feature Request
about: Suggest an idea or enhancement for Neural Arena
title: '[FEAT] '
labels: enhancement, discussion
assignees: ''
---

## Problem Statement
Is your feature request related to a problem? Please describe. (e.g. "I want to run RAG simulations but the current context compiler doesn't support vector retrieval hooks.")

## Proposed Solution
A clear and concise description of what you want to happen. Explain how the proposed feature fits into Neural Arena's core architectures (e.g., EventBus, EventStore, FSM components).

## Technical Implementation Notes (Optional)
If you have ideas on how to implement this, describe:
- Affected files or components (e.g., `src/cognition/ContextCompiler.ts`, `src/dashboard/src/panels/BenchmarkResults.tsx`)
- New event definitions or schema extensions required

## Alternatives Considered
A clear and concise description of any alternative solutions or features you've considered.

## Additional Context
Add any other context or screenshots about the feature request here.
```

---

## 4. Pull Request Template (`PULL_REQUEST_TEMPLATE.md`)

Located in `.github/PULL_REQUEST_TEMPLATE.md`, this checklist serves as the binding developer contract. Pull requests that do not verify the architecture invariants checklist will be rejected.

### Markdown Source
```markdown
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
```
