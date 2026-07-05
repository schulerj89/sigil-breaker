# Landscape Title HUD Assessment

Status: complete for title concept selection, font direction, color direction, and title/loading UI constraints.

## Concepts Reviewed

- `generated-designs/001-no-text-no-letters-no-logos-no-watermark-create-a-mobile-lan.png`
- `generated-designs/002-no-text-no-letters-no-logos-no-watermark-create-a-mobile-lan.png`
- `generated-designs/003-no-text-no-letters-no-logos-no-watermark-create-a-mobile-lan.png`

## Selected

`002-no-text-no-letters-no-logos-no-watermark-create-a-mobile-lan.png`

Concept 002 was selected because it has the cleanest dark left-side title zone, enough lower-left room for a start button, no fake UI or title text artifacts, and a metallic facility/weapon frame that matches the current FPS foundation without covering the mobile thumb zones.

## Runner-Up

`001-no-text-no-letters-no-logos-no-watermark-create-a-mobile-lan.png`

Concept 001 has a strong sigil read, but the corridor framing and enemy silhouettes compete more with the title zone and first viewport composition.

## Font Direction

Use a wide condensed sci-fi sans style in all caps with squared cuts. Avoid decorative rune fonts for primary UI; use sigil language as visual texture or accent only. The implemented CSS uses a local system fallback stack and zero letter spacing to preserve layout predictability on mobile.

## Color Direction

Use gunmetal and charcoal as the base, cyan-teal for primary UI glow, restrained toxic green for sigil energy, small amber warning highlights, and near-white title text with dark shadow.

## Risks

- Keep title/start anchored left so it does not sit over the center-right portal.
- Keep the start button above the floor highlights and away from the weapon silhouette.
- Test cover cropping across 16:9 and wider landscape mobile viewports.
- Avoid extra fake HUD panels on the title image; the background already has enough sci-fi detail.
- Keep the runtime background compressed. The selected WebP is 212252 bytes.
