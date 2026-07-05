# elevenlabs-audio-music-agent

Run: 20260705-audio-consistency
Status: complete

## What It Saw

- Weapon fire used `HTMLAudioElement` pools as the primary path, which can clip or delay rapid overlapping shots on mobile.
- VAULT used the same generated ElevenLabs MP3 as before but still sat too low in the gameplay mix.
- Enemy projectiles spawned visually and damaged the player but had no audio callback.

## Decision

- Decode the five committed ElevenLabs weapon MP3s into Web Audio `AudioBuffer`s after gesture unlock.
- Use `AudioBufferSourceNode` plus per-shot `GainNode` for held-fire playback, while preserving the existing HTML audio pool as a pre-decode fallback.
- Raise VAULT runtime/source-metadata volume to `1.8` without changing the MP3 bytes or hash.
- Reuse the committed RIFT precision SFX for enemy projectiles at lower gain and lower playback rate until a dedicated ElevenLabs projectile asset is generated.

## Caught

- The prior fallback-only path could report a shot without surfacing whether playback failed, so debug snapshots now include `webAudioPlayRequests`, `htmlFallbackPlayRequests`, `enemyProjectilePlayRequests`, and `playFailures`.
- The compressed MP3 fetch bytes are released after successful decode to avoid retaining both raw and decoded copies during gameplay.

## Validation

- `npm test`: passed
- `npm run lint`: passed
- `npm run validate:assets`: passed
- `npm run validate:levels`: passed
- `npm run build`: passed
- `npm run validate:browser`: passed all five landscape viewport projects
