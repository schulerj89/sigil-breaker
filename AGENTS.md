# Agent Instructions

## Project Context

This repo is the Sigilbreaker mobile-first landscape Three.js FPS rewrite. The sub-agent planning and QA system is documented under `docs/sub-agents/`.

When working on the FPS rewrite, read `docs/sub-agents/README.md`, `docs/sub-agents/game-vision.md`, and `docs/sub-agents/gates.md` before changing code.

## Completion Workflow

Unless the user explicitly says not to, finish every code or documentation change request by running the relevant validation, committing the completed work, and pushing it to `origin/main`.

Do not commit broken work just to satisfy this rule. If validation fails and cannot be fixed in the same turn, report the failure and leave the work uncommitted unless the user explicitly asks for a commit anyway.

## GitHub Pages Deployment

Source code lives on `main`, but GitHub Pages publishes generated files from the `gh-pages` branch. The Pages source is intentionally set to legacy branch publishing because artifact deployment with `actions/deploy-pages@v5` repeatedly failed with GitHub's generic deployment error after successful builds.

Do not edit `gh-pages` directly. The `Deploy GitHub Pages` workflow builds from `main`, writes cache-busted production files into `gh-pages`, and asks Pages to rebuild. Do not switch the workflow back to `actions/deploy-pages@v5` unless the Pages deployment model is intentionally being revisited.

The Pages workflow is intentionally lightweight: install, build, publish, and request a Pages rebuild. Heavy validation (`npm test`, `npm run lint`, `npm run validate:levels`, `npm run validate:assets`, and `npm run validate:browser`) is run locally before committing/pushing instead of inside the deploy workflow.

The repo `GITHUB_TOKEN` can push the generated branch but could not change Pages source settings through the API (`403`). If Pages fails again, check the workflow logs, the `gh-pages` branch contents, the Pages API/source setting, and the deployed `version.json` before changing the workflow.

## Credentials And Secrets

Use the local Windows secret broker for all API keys and credentials. Do not read plaintext key files from `C:\Users\joshs\Projects`, do not print secret values, and do not write secrets into docs, logs, JSON handoffs, screenshots, commits, or artifacts.

The secret manager project is available at:

```text
C:\Users\joshs\Projects\agent-secret-broker
```

The installed command is available on PATH:

```powershell
agent-secret
```

List available secret names only:

```powershell
agent-secret names
```

Run commands with credentials injected as environment variables:

```powershell
agent-secret with SECRET_NAME -- <command>
```

Use multiple credentials:

```powershell
agent-secret with SECRET_ONE SECRET_TWO -- <command>
```

Map a stored secret name to a different environment variable when needed:

```powershell
agent-secret with STORED_SECRET_NAME=ENV_VAR_NAME -- <command>
```

Check broker health without revealing values:

```powershell
agent-secret doctor
```

Do not use `agent-secret get --reveal` unless the user explicitly asks for manual plaintext retrieval. Prefer `agent-secret with ... -- <command>` for build scripts, asset generation, ElevenLabs calls, Meshy calls, OpenAI calls, or any other credentialed workflow.
