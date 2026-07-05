# performance-budget-agent

Run: 20260705-audio-consistency
Status: complete

## What It Saw

- No new audio files were added; foundation audio payload remains `858752B`.
- Decoded SFX playback adds one `AudioBufferSourceNode` and one `GainNode` per sound play.
- Enemy projectile sound reuses `audio.weapon.rift.elevenlabs`, so projectile audio has no new network payload.

## Decision

- Accept decoded Web Audio one-shots for combat SFX because they solve rapid-fire overlap better than small HTML media pools.
- Keep the HTML media pool as fallback only, preserving early first-shot behavior before decode finishes.
- Watch sustained audio node churn on physical mobile hardware if fire rates increase or enemies fire in larger groups.

## Validation

- `npm run validate:browser`: passed all five landscape viewport projects.
- Production JS chunk in the latest validation: about `686.64 kB` minified.
