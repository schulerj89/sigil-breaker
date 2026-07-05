# ElevenLabs Audio/Music Agent Notes

## Decision

Generated seven committed `eleven_v3` text-to-speech MP3 files with the requested voice id through the local secret broker.

## Asset Policy

- Files live under `public/assets/audio/elevenlabs-foundation/`.
- Runtime code uses cache-busted public URLs only.
- The Voice Lab lazy-loads clips on tap and stops the current clip before playing another.
- Metadata is recorded in `public/assets/audio/elevenlabs-foundation/source-metadata.json` and `docs/assets/source-ledger.json`.

## Risks Caught

- Browser runtime must not call ElevenLabs or store API keys.
- Voice previews should not be part of the boot asset count or normal gameplay audio preload.
