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
- VAULT keeps the same generated MP3 file, but runtime playback gain and source metadata volume were raised to `1.0` because the heavy pulse sounded too quiet.
- Generated two additional ElevenLabs weapon SFX for RIFT and TORCH through `agent-secret with ELEVENLABS_API_KEY -- ...`.
- Replaced the 24 second foundation loop with a 48 second ElevenLabs instrumental combat loop at `foundation-combat-loop-long.mp3`.
- Audio manifest now preloads six committed MP3 assets: five weapon SFX and one longer music loop.
- Source metadata and the asset ledger were regenerated from actual hashes and bytes after audio generation.
- Runtime weapon SFX pools are now created immediately from the manifest, before async byte verification completes, so an early first shot has a playable SFX element available.
- Audio debug snapshots now report `sfxPoolProfiles`, `playRequests`, and `missedPlayRequests` so smoke QA can catch a shot that had no SFX pool candidate.

## Decisions

- Treat this audio as generated provider output, not CC0 external art; the asset validator now has a generated-audio metadata gate.
- Use MP3 44.1 kHz 128 kbps output to keep the MVP foundation payload small.
- Keep weapon SFX dry and short so later enemy/impact sounds can layer without masking the fire cadence.
- Use runtime gain tweaks for small mix fixes when the source file, hash, and bytes do not change.
- Make the foundation music loop muted/unmuted through UI state and localStorage, while still starting only after user interaction.
- Keep the longer music loop as the default foundation music asset and remove the old 24 second MP3 from the runtime set.
- Keep audio byte verification as the provenance/load gate, but do not block creation of local SFX playback pools on that async check.

## Caught Issues

- Existing sound effects were local synthesis and sounded thin because they had no authored audio assets.
- Asset validation previously assumed every source must be CC0, which blocked generated audio provenance.
- Browser autoplay policy requires unlock after a user gesture, so music cannot start reliably at boot.
- The longer loop roughly doubles the foundation audio payload but stays well under the 5 MB MVP audio budget.
- The earlier SFX preload path created weapon audio pools only after async fetch verification, so very early shots could miss sound until a later cadence shot.

## Next Handoff Notes

- Mobile game-feel and playthrough QA should check whether the 24 second loop feels too repetitive during longer routes.
- Future weapon upgrades should add separate reload, impact, pickup, and UI SFX assets instead of reusing these firing sounds.
- Audio QA should compare VAULT against SPARK and BORE after future SFX changes so heavy shots do not fall behind the mix again.
- Audio QA should compare RIFT and TORCH against the original three weapons on device speakers because small MP3 SFX can sound similar at phone volume.
- Mobile smoke should keep checking `missedPlayRequests` stays at zero during hold-fire.
- Any voice line must include captions before gameplay use.
