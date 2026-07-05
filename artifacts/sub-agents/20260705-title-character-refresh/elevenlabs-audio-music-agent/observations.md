# ElevenLabs Audio Music Agent Observations

Status: complete for title music planning and generation.

## What It Saw

- Combat music already exists as `audio.music.foundation.elevenlabs`.
- The title screen needs a lighter mascot-adventure loop that does not replace the combat loop.
- Browser autoplay still requires a user gesture before Web Audio playback can begin.

## Decision

- Add `audio.music.title.playful.elevenlabs` as a separate committed MP3 generated through the local secret broker.
- Use ElevenLabs `music_v1`, `music_length_ms: 90000`, `force_instrumental: true`, and `mp3_44100_128`.
- Keep title and gameplay music in the same Web Audio unlock path and switch the active music asset by game phase.

## Caught Issues

- The title loop is 1,439,914 bytes, within the 2 MB hard cap for this pass and well inside the 5 MB foundation audio gate.
- Do not block title rendering on decoded music; fetch/byte verification is enough for boot readiness.
- Music may only start after the first pointer gesture, which is expected browser behavior.

## Handoff

- Runtime asset: `public/assets/audio/elevenlabs-foundation/title-playful-loop.mp3`.
- Runtime code: `src/game/audioManifest.ts` and `src/game/weapons/weaponAudio.ts`.
- Provenance: `public/assets/audio/elevenlabs-foundation/source-metadata.json` and `docs/assets/source-ledger.json`.

## Final Runtime Notes

- The title phase uses `audio.music.title.playful.elevenlabs`.
- Gameplay switches back to `audio.music.foundation.elevenlabs` after the Play transition.
- `src/game/createGame.ts` calls `weaponSystem.setMusicPhase(gamePhase === 'gameplay' ? 'gameplay' : 'title')` from the phase application path.
- Browser smoke QA asserts the title active music asset before opening the character debug page and asserts the gameplay active music asset after starting the level.
