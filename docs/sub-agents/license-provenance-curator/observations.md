# Observations: license-provenance-curator

Status: complete for first weapon intake.

## What It Saw

- Reviewed Kenney Blaster Kit 2.1 for the first weapon import.
- Official Kenney source and the mirrored itch page identify the kit as CC0.
- Committed a source ledger and source-local metadata file with license, source URL, selected assets, hashes, and byte counts.
- Meshy-generated `player.hero.gadget-gremlin` source assets are now recorded in the source ledger with generated-provider metadata and sanitized Meshy task metadata.
- GPT Image 2 concept provenance for the selected main-character design is stored in `docs/assets/openai-main-character-concepts.json`.

## Decisions

- Approve the three selected Kenney weapon models for repo use.
- Keep `public/assets/weapons/kenney-blaster-kit/LICENSE.txt` with the imported files.
- Continue rejecting unknown, editorial-only, noncommercial, and ripped sources.
- Do not mark the Meshy main character production-approved until Meshy account/output terms are reverified before shipping.

## Caught Issues

- The first ledger exists at `docs/assets/source-ledger.json`; future imports must update it and pass `npm run validate:assets`.
- Meshy output rights can differ by account plan; the current character is staged as source/provenance and should not be treated as final production-approved art yet.

## Next Handoff Notes

- Asset registry and QA agents should read `docs/assets/source-ledger.json` as the source of truth for file hashes and licensing.
- Before gameplay integration, re-check Meshy terms/account plan and preserve the generated metadata under `tools/meshy/generated/meshy-gadget-gremlin/`.
