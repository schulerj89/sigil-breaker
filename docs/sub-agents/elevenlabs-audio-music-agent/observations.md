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
- VAULT keeps the same generated MP3 file, but runtime playback gain and source metadata volume were raised to `1.8` because the heavy pulse sounded too quiet.
- Generated two additional ElevenLabs weapon SFX for RIFT and TORCH through `agent-secret with ELEVENLABS_API_KEY -- ...`.
- Replaced the 24 second foundation loop with a 48 second ElevenLabs instrumental combat loop at `foundation-combat-loop-long.mp3`.
- Audio manifest now preloads six committed MP3 assets: five weapon SFX and one longer music loop.
- Source metadata and the asset ledger were regenerated from actual hashes and bytes after audio generation.
- Runtime weapon SFX pools are now created immediately from the manifest, before async byte verification completes, so an early first shot has a playable SFX element available.
- Audio debug snapshots now report `sfxPoolProfiles`, `playRequests`, and `missedPlayRequests` so smoke QA can catch a shot that had no SFX pool candidate.
- Weapon SFX now decode into Web Audio `AudioBuffer`s after the first user gesture, and hot-path firing uses buffer sources so overlapping shots are not clipped by the HTML media pool.
- The HTML audio pool remains as a fallback before decode completes and reports `htmlFallbackPlayRequests`; successful buffer playback reports `webAudioPlayRequests`.
- VAULT keeps the same generated MP3 file, but runtime gain and source metadata volume were raised to `1.8` because it was still too quiet in gameplay.
- Enemy projectile SFX currently reuses the committed ElevenLabs RIFT precision MP3 through Web Audio at lower gain and playback rate, giving projectiles a distinct cue without adding a new asset payload.
- Latest `npm run validate:browser` passed all five landscape viewport projects with decoded profiles, Web Audio shot playback, zero SFX play failures, and projectile sound request coverage.
- Foundation music now also uses the Web Audio graph: the MP3 is fetched, byte-verified, decoded after audio unlock, and looped with a dedicated gain node instead of relying on `HTMLAudioElement.play()`.
- Audio loading is parallelized with `Promise.all`; playback concurrency comes from separate Web Audio source nodes mixed by the browser audio context, not from awaiting multiple play promises.
- Browser smoke now checks `snapshot.weapon.audio.musicDecoded` and `musicPlaying` so losing the music loop is a test failure.

## Decisions

- Treat this audio as generated provider output, not CC0 external art; the asset validator now has a generated-audio metadata gate.
- Use MP3 44.1 kHz 128 kbps output to keep the MVP foundation payload small.
- Keep weapon SFX dry and short so later enemy/impact sounds can layer without masking the fire cadence.
- Use runtime gain tweaks for small mix fixes when the source file, hash, and bytes do not change.
- Make the foundation music loop muted/unmuted through UI state and localStorage, while still starting only after user interaction.
- Keep the longer music loop as the default foundation music asset and remove the old 24 second MP3 from the runtime set.
- Keep audio byte verification as the provenance/load gate, but do not block creation of local SFX playback pools on that async check.
- Prefer decoded Web Audio buffer playback for repeated combat SFX; keep `HTMLAudioElement` pools only as a pre-decode fallback.
- Reuse the RIFT sound for enemy projectiles for this MVP pass, but generate a dedicated ElevenLabs projectile/impact SFX pair before finalizing enemy audio identity.
- Use Web Audio for both looping music and one-shot SFX so all combat audio shares one unlock and mix path.

## Caught Issues

- Existing sound effects were local synthesis and sounded thin because they had no authored audio assets.
- Asset validation previously assumed every source must be CC0, which blocked generated audio provenance.
- Browser autoplay policy requires unlock after a user gesture, so music cannot start reliably at boot.
- The longer loop roughly doubles the foundation audio payload but stays well under the 5 MB MVP audio budget.
- The earlier SFX preload path created weapon audio pools only after async fetch verification, so very early shots could miss sound until a later cadence shot.
- Small HTML media pools can cut off or delay rapid overlapping shots on mobile; Web Audio one-shot sources are a better fit for held-fire combat cadence.
- `HTMLAudioElement.play()` can fail or remain silent under gesture/autoplay edge cases; the music loop should stay on Web Audio where the same gesture unlock starts the context and all sources.

## Next Handoff Notes

- Mobile game-feel and playthrough QA should check whether the 24 second loop feels too repetitive during longer routes.
- Future weapon upgrades should add separate reload, impact, pickup, and UI SFX assets instead of reusing these firing sounds.
- Audio QA should compare VAULT against SPARK and BORE after future SFX changes so heavy shots do not fall behind the mix again.
- Audio QA should compare RIFT and TORCH against the original three weapons on device speakers because small MP3 SFX can sound similar at phone volume.
- Mobile smoke should keep checking `missedPlayRequests` and `playFailures` stay at zero during hold-fire.
- Future audio generation should add dedicated ElevenLabs projectile launch, projectile hit, enemy hit, and enemy death cues so reused weapon sounds do not become confusing.
- Music smoke should keep checking both decoded and playing state after the title start gesture.
- Any voice line must include captions before gameplay use.
