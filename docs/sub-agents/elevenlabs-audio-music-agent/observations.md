# Observations: elevenlabs-audio-music-agent

Status: complete for foundation weapon SFX and music slice.

## What It Saw

- Current gun sounds were procedural Web Audio oscillator/noise bursts, not ElevenLabs assets.
- The local secret broker exposes `ELEVENLABS_API_KEY`; generation ran through `agent-secret with ELEVENLABS_API_KEY -- ...`.
- Generated three weapon SFX MP3s through ElevenLabs text-to-sound-effects and one 24 second foundation combat music loop through ElevenLabs music stream.
- Generated assets are committed under `public/assets/audio/elevenlabs-foundation/`.
- Source prompts, endpoint names, model IDs, output format, bytes, hashes, LUFS targets, loopability, and intended use are recorded in `source-metadata.json` and `docs/assets/source-ledger.json`.
- Runtime code uses cache-busted public MP3 files only; no ElevenLabs secret is present in browser code.
- Music unlocks from a user gesture and has a compact mute toggle in the landscape HUD.

## Decisions

- Treat this audio as generated provider output, not CC0 external art; the asset validator now has a generated-audio metadata gate.
- Use MP3 44.1 kHz 128 kbps output to keep the MVP foundation payload small.
- Keep weapon SFX dry and short so later enemy/impact sounds can layer without masking the fire cadence.
- Make the foundation music loop muted/unmuted through UI state and localStorage, while still starting only after user interaction.

## Caught Issues

- Existing sound effects were local synthesis and sounded thin because they had no authored audio assets.
- Asset validation previously assumed every source must be CC0, which blocked generated audio provenance.
- Browser autoplay policy requires unlock after a user gesture, so music cannot start reliably at boot.

## Next Handoff Notes

- Mobile game-feel and playthrough QA should check whether the 24 second loop feels too repetitive during longer routes.
- Future weapon upgrades should add separate reload, impact, pickup, and UI SFX assets instead of reusing these firing sounds.
- Any voice line must include captions before gameplay use.
