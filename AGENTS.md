# Agent Instructions

## Project Context

This repo is currently the Sigilbreaker Phaser MVP. The planned mobile-first landscape Three.js FPS rewrite is documented under `docs/sub-agents/`.

When working on the FPS rewrite, read `docs/sub-agents/README.md`, `docs/sub-agents/game-vision.md`, and `docs/sub-agents/gates.md` before changing code.

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

