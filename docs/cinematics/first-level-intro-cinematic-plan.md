# First Level Intro Cinematic Plan

Status: planning decision, no runtime implementation yet.
Date: 2026-07-05
Owner: game direction review with camera, HUD, dialogue, audio, and coordinator handoff inputs.

## Decision Summary

Build the first intro as a short in-engine mission briefing that transitions directly from the title screen into the first playable room. The MVP should use a flat commander hologram portrait with text captions and ElevenLabs voice, plus the existing 3D Glyph model for player-side personality moments. Do not block the first intro on a new commander GLB.

The commander should eventually become a 3D character, but the first implementation should prove the cinematic timing, tutorial onboarding, camera cuts, subtitle layout, skip behavior, and audio mix before investing in a rigged Meshy model. A flat image can be replaced later by a bust-only or full-body commander GLB without changing the scene structure.

Recommended first implementation:

- Commander presentation: flat generated portrait as a hologram panel.
- Glyph presentation: existing 3D model, idle or gun-hold animation, no mouth sync.
- Voice: yes, commander narration plus one short Glyph response.
- Text: yes, burned into UI as live captions, not baked into images.
- Tutorial framing: yes, Level 1 becomes "Rift Deck 01", a controlled training breach that teaches move, look, fire, reload, enemy damage, and exit.
- Length: 28 to 38 seconds if unskipped.
- Skip: mandatory after the first two seconds, with all required assets still loaded and input restored.
- First playable handoff: camera lands at the normal first-person spawn and immediately gives control.

## Player-Facing Goal

The intro should answer four questions before the first enemy encounter:

- Who am I? Glyph, a playful field operator with gadget energy.
- Who is guiding me? Commander Kade, a calm mission lead.
- What am I doing? Closing unstable rifts by clearing hostile rooms and reaching the exit beacon.
- How do I start? Move, aim, fire, watch ammo, survive HP pressure, and find the X marker.

The tone should be energetic but not noisy. Gadget Rift should feel like a Saturday-morning sci-fi shooter with mobile-first clarity: fast, readable, colorful, and a little cocky, but never confusing.

## Commander Direction

### Name

Use "Commander Kade" as the working name.

Why:

- One syllable, easy to hear in noisy mobile audio.
- Serious enough to contrast Glyph.
- Not tied to a specific animal, mascot, or existing franchise reference.
- Works in short UI text: "KADE", "CMD KADE", "COMMANDER KADE".

### Visual Identity

Commander Kade should look like a veteran rift-control officer from the same world as Glyph, but not another mascot hero.

Recommended look:

- Mid-30s to mid-40s field commander.
- Human or near-human silhouette for instant readability.
- Warm medium skin tone, sharp cheekbones, confident expression.
- Short silver-black hair or close-cropped hair with one cyan-lit tech streak.
- One angular teal visor lens over one eye, not a full helmet.
- Gunmetal tactical jacket with amber rank tabs and cyan-green rift glow piping.
- Compact shoulder comm unit projecting the hologram frame.
- Fingerless tactical gloves visible in portrait if hands enter frame.
- No oversized fantasy armor, capes, skull motifs, military realism, or franchise-like costume elements.

Silhouette rule:

- Glyph is playful, orange, spiky, and kinetic.
- Kade is composed, vertical, angular, and readable in a small portrait.

Color rule:

- Kade should reuse the game palette: gunmetal, charcoal, cyan-teal, toxic green, amber highlights.
- Keep Kade's skin and jacket warmer/darker than the bright rift portal so captions and the hologram frame stay readable.

### Personality

Kade is the straight line that makes Glyph funnier:

- Calm under pressure.
- Gives direct orders.
- Trusts Glyph, but knows Glyph improvises too much.
- Uses crisp mission language.
- Avoids long exposition.

Sample direction:

- Kade: "Glyph, rift pressure is climbing. We need this deck sealed."
- Glyph: "Glyph at your service! Mostly calibrated."
- Kade: "Move fast, watch your ammo, and do not hug the monsters."

## Flat Image vs 3D Commander Decision

### Chosen MVP: Flat Hologram Portrait

Use a generated flat portrait as a hologram projection during the intro.

Reasons:

- Fastest path to a good cinematic without another rigging cycle.
- Keeps first deploy payload smaller than a second animated character model.
- Avoids Meshy turnaround until the commander design is approved.
- No mouth-sync requirement. Voice can play over a subtle waveform, eye flicker, and scanline animation.
- Works well on mobile landscape because it can live in a controlled safe UI area.
- Easier to iterate on face, colors, rank marks, and commander personality.

How it should appear:

- A semi-transparent rectangular hologram panel appears left or right of center, depending on camera shot.
- Portrait should be cropped bust-up, not full body.
- The panel should have a thin cyan border, amber rank tick marks, a light scanline shader/CSS overlay, and a small waveform while voice plays.
- Captions should be live DOM below the panel or inside a bottom cinematic band, not baked into the image.

### Later Upgrade: 3D Commander Bust

Upgrade to 3D only after the MVP intro is approved.

If upgraded:

- Generate a bust-only or waist-up GLB, not a full combat-ready character.
- Required simple animations: idle, lean-in, point, nod, comm-glitch.
- Meshy prompt should target clean topology, small material count, and stylized sci-fi officer shape.
- No mouth animation required. Use head/eye movement and hologram waveform.
- Put the model in a hologram frame, not physically in the room, to avoid navigation/collision questions.

Decision gate for 3D:

- Only create the 3D commander if the flat portrait version feels emotionally too static after browser screenshot/video QA.
- Do not generate Meshy assets before approving Kade's portrait design and script.

## Cinematic Structure

### Total Runtime

Target: 32 seconds.

Allowable range: 28 to 38 seconds.

Why:

- Under 30 seconds may not teach enough.
- Over 40 seconds is too long before first control on mobile.
- Skipping must be available because repeated testing should not require watching the full sequence.

### Shot Breakdown

| Time | Shot | Camera | Visual | Audio/Text | Tutorial Purpose |
| --- | --- | --- | --- | --- | --- |
| 0.0-2.0 | Rift wake | Wide fixed camera in first room, no HUD | Room lights pulse, rift glow appears near the exit direction | Low warning swell, no voice yet | Establish level space before UI |
| 2.0-6.0 | Commander hail | Camera pushes toward hologram panel | Kade portrait appears with scanline boot | Kade: "Glyph, rift pressure is climbing. We need this deck sealed." | Introduce guide and objective |
| 6.0-10.0 | Glyph response | Cut to existing 3D Glyph at spawn using idle or gun-hold | Glyph bounces/leans, no mouth sync | Glyph: "Glyph at your service! Mostly calibrated." | Establish hero personality |
| 10.0-14.0 | Route preview | Camera glides from spawn toward first lane, then back | Highlight floor arrows or cyan path pulses toward first open lane | Kade: "Move through the lanes. Keep the exit beacon in mind." | Teach movement and route |
| 14.0-19.0 | Weapon briefing | Camera frames first-person weapon silhouette or third-person Glyph raising gun | Spark/Bore quick hologram icons or muzzle-safe preview | Kade: "Spark is ready. Fire in short bursts and watch your ammo." | Teach firing and ammo |
| 19.0-23.0 | Threat ping | Camera cuts to first enemy behind safe distance | Enemy gets red debug-like ping ring, then ring fades | Kade: "Hostiles bite up close and shoot when they track you." | Teach projectile and contact damage |
| 23.0-27.0 | Reload/health callout | Camera returns to HUD-safe gameplay view | HP and ammo briefly brighten in normal HUD positions | Kade: "Your suit is light. Twenty-five hit points. Do not trade hits." | Teach HUD and fragility |
| 27.0-31.5 | Control handoff | Camera blends to first-person spawn | HUD fades in, d-pad/action buttons activate | Glyph: "You got it, Captain." | Transition to play |
| 31.5-32.0 | Begin | Normal gameplay camera | Crosshair settles, enemies begin normal AI | Music shifts to gameplay loop | Start player control |

### Camera Language

The intro should use readable, slow camera moves. It should not start with shaky action.

Rules:

- No rapid cuts under one second.
- No camera roll.
- No spinning 360 camera before gameplay starts.
- Keep the first level geometry readable.
- Avoid camera paths through walls.
- Keep the HUD hidden until the control handoff, except for a deliberate HUD callout shot.
- Do not show the first-person weapon firing during the cinematic unless input is disabled and the shot is purely demonstrative.

Recommended camera style:

- Opening: slow dolly, low FOV spectacle.
- Briefing: locked medium shot on hologram.
- Glyph: medium third-person hero shot.
- Tutorial preview: gentle path glide.
- Handoff: blend into exact first-person spawn.

## Tutorial Level Direction

Level 1 should become an authored tutorial wrapper around the current foundation level, not a separate training map yet.

### Level Name

Working name: "Rift Deck 01".

### First Level Teaching Beats

Teach in this order:

1. Move: player sees a clear lane immediately.
2. Look: first enemy or marker is offset enough to require camera control.
3. Fire: first enemy has enough health to show hit feedback but not punish slow aim.
4. Ammo/reload: Spark can run low if held too long, and the reload HUD shows clearly.
5. Damage: a projectile or contact warning teaches 25 HP fragility.
6. Exit: X marker is framed as the stabilizer beacon.

### Gameplay Changes To Consider Later

These are not part of the planning report implementation, but should be considered when the intro becomes playable:

- Temporarily delay enemy projectile firing until after the intro finishes.
- Keep first enemy outside immediate contact range after control is handed back.
- Add a one-time "MOVE" pulse on the left stick only if the player is idle for three seconds.
- Add a one-time "HOLD TO FIRE" pulse on the fire button only after the crosshair points near the first enemy.
- Add a one-time "RELOADING" pulse if the first reload happens before the first enemy dies.
- Avoid large tutorial text boxes during combat. Use short captions or icon pulses.

## Voice Direction

### Use Voice?

Yes.

Voice is worthwhile because the player is on a small screen and the intro can carry story while visual focus stays on the level. The runtime already supports gesture-unlocked Web Audio, committed ElevenLabs MP3 assets, voice counters, and a Voice Lab. Generate audio build-time only. Do not use runtime ElevenLabs calls.

### Voice Setup

Commander Kade:

- Needs a new voice identity, distinct from Glyph.
- Direction: composed, tactical, slightly warm, no parody drill-sergeant delivery.
- ElevenLabs v3 can use bracketed tags, but keep them restrained.
- Target loudness: close to existing voice target, around -16 LUFS.

Glyph:

- Reuse current Glyph voice ID and style.
- Use one or two short lines only.
- Do not overuse catchphrases before the player has control.

### Script Draft

This is the recommended first script. It is intentionally short.

Kade line 1:

```text
[calm, urgent] Glyph, rift pressure is climbing. We need this deck sealed.
```

Glyph line 1:

```text
[confident, playful] Glyph at your service! Mostly calibrated.
```

Kade line 2:

```text
[focused] Move through the lanes. Keep the exit beacon in mind.
```

Kade line 3:

```text
[direct] Spark is ready. Fire in short bursts and watch your ammo.
```

Kade line 4:

```text
[warning] Hostiles bite up close and shoot when they track you.
```

Kade line 5:

```text
[serious] Your suit is light. Twenty-five hit points. Do not trade hits.
```

Glyph line 2:

```text
[excited] You got it, Captain.
```

Optional shorter version if the intro feels too long:

```text
Kade: [calm, urgent] Glyph, rift pressure is climbing. Seal this deck.
Glyph: [confident, playful] Glyph at your service! Mostly calibrated.
Kade: [direct] Move, shoot, watch your ammo, and do not trade hits.
Glyph: [excited] You got it, Captain.
```

### Caption Rules

- Always show captions for voice.
- Captions should be live DOM text for localization and testing.
- Keep each caption under two lines on 667 x 375 landscape.
- Put captions in a bottom cinematic band during the intro.
- Use speaker labels: "KADE" and "GLYPH".
- Do not cover the crosshair during the final handoff.

## Music And Sound

Recommended audio stack:

- Start with a quiet rift hum and warning pulse during the loading/title transition.
- Duck title music during the first Kade line.
- Bring in low combat rhythm during route preview.
- Crossfade into the existing foundation combat loop at control handoff.
- Add one short UI chirp when Kade's hologram opens.
- Add one low enemy ping cue when the first hostile is highlighted.

Do not generate a new full song for this slice. Use existing title/gameplay music and add short stingers only if needed. New VO matters more than new music here.

## UI And HUD Direction

During cinematic:

- Hide normal controls for the first 27 seconds.
- Show a small "SKIP" button after 2 seconds in the top-right safe area.
- Use cinematic bars only if they do not crush the 390 px tall viewport.
- Captions live in the bottom band.
- Hologram commander panel should not overlap the eventual d-pad or fire button areas.

During handoff:

- Fade in health, ammo, mute, and debug toggle.
- Fade in d-pad and fire/switch controls.
- Briefly pulse ammo and health when Kade mentions them.
- Do not show debug metrics unless debug is enabled.

## Implementation Recommendation

### New Assets

MVP required:

- `public/assets/cinematics/commander-kade-hologram.webp`
- Commander Kade VO MP3 lines, committed under the existing ElevenLabs foundation audio folder or a new `assets/audio/elevenlabs-cinematics/` folder.
- Source metadata for generated image and audio in `docs/assets/source-ledger.json` or related generated metadata file.

MVP not required:

- Commander 3D model.
- Mouth animation.
- New music loop.
- Full tutorial-specific level art.

### New Runtime Systems

Recommended files or systems:

- `src/game/introCinematicStage.ts`
- `src/game/cinematicTimeline.ts` or a compact local timeline in the stage.
- `src/game/cinematicCaptions.ts` if caption logic needs reuse with later boss intros.
- Extend `GamePhase` with `intro-cinematic`.
- Extend debug snapshot with `ui.introCinematic`.
- Add QA hook to force intro replay from title or debug.

### Integration Flow

1. Player taps PLAY.
2. Loading/title audio unlock already exists from interaction.
3. Combat state resets.
4. Game enters `intro-cinematic`, not `gameplay`.
5. Intro stage preloads commander image and voice.
6. Intro plays timeline or lets player skip after 2 seconds.
7. On complete/skip, stage disposes temporary objects or hides DOM, restores camera FOV, resets input states, and enters `gameplay`.
8. Gameplay music starts or resumes.

## Technical Risks

### Risk: Mobile Autoplay

Audio cannot be trusted before user interaction. Starting from the PLAY tap should unlock audio, but QA must verify commander VO starts after tap.

Mitigation:

- Route commander VO through the existing Web Audio manager.
- Add debug counters for intro voice play requests and active voice ID.

### Risk: Input Restoration

Cutscenes can leave pointer state stuck if gameplay controls stay active.

Mitigation:

- Disable `FpsControls` and `WeaponSystem` input while in `intro-cinematic`.
- Clear fire/look/move state on both intro start and intro end.
- Add Playwright smoke: skip intro, then move/look/fire.

### Risk: Camera Clips Through Walls

The first level has tight walls and roof. Camera paths can easily hide the scene.

Mitigation:

- Use fixed authored shots from safe coordinates.
- Keep path preview above the lane center, not near wall edges.
- Add screenshot QA at 844 x 390 and 667 x 375.

### Risk: Payload Growth

Another rigged commander GLB could be expensive.

Mitigation:

- Use WebP portrait first.
- If 3D is later approved, use a bust-only GLB and run it through asset budget checks before gameplay integration.

### Risk: Too Much Tutorial Text

Mobile players will not read long paragraphs before first control.

Mitigation:

- Use short voice plus captions.
- Teach with camera framing and UI pulses.
- Avoid more than one instruction per shot.

## QA Plan

Minimum automated checks for first implementation:

- Title PLAY enters `intro-cinematic`, then `gameplay`.
- Skip button appears after 2 seconds and works.
- After skip, player can move, look, fire, and switch weapons.
- HUD is hidden during cinematic except captions/skip, then normal HUD returns.
- `snapshot.ui.introCinematic` exposes phase, timeline time, active shot ID, skippable state, and active caption.
- No console errors or failed requests.
- Commander image URL is cache-busted.
- Intro voice assets are loaded and decoded after user gesture.
- 667 x 375 and 844 x 390 screenshots show captions fitting.

Manual visual QA:

- Capture opening hologram shot.
- Capture Glyph response shot.
- Capture enemy ping shot.
- Capture final frame one second after player gains control.

## Production Order

Recommended next implementation slices:

1. Create commander Kade image concepts and pick one portrait direction.
2. Generate final flat commander hologram image with transparent or dark clean background.
3. Write and generate Kade VO lines through ElevenLabs v3 using secret broker.
4. Add `intro-cinematic` phase, skip behavior, captions, and flat hologram panel.
5. Add camera shot timeline using safe first-level coordinates.
6. Add browser smoke for title to intro to gameplay and skip path.
7. Review screenshots on phone landscape.
8. Only then decide whether Kade needs a 3D Meshy bust.

## Final Recommendation

Do the first intro as a polished flat-hologram commander briefing with live captions, existing Glyph 3D response shots, and build-time ElevenLabs VO. This gives the game a stronger identity immediately, makes Level 1 feel intentional as a tutorial, and preserves the option to upgrade Commander Kade to a 3D Meshy character later without spending asset budget before the cinematic direction is proven.
