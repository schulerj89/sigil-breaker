# Observations: license-provenance-curator

Status: complete for first weapon intake.

## What It Saw

- Reviewed Kenney Blaster Kit 2.1 for the first weapon import.
- Official Kenney source and the mirrored itch page identify the kit as CC0.
- Committed a source ledger and source-local metadata file with license, source URL, selected assets, hashes, and byte counts.

## Decisions

- Approve the three selected Kenney weapon models for repo use.
- Keep `public/assets/weapons/kenney-blaster-kit/LICENSE.txt` with the imported files.
- Continue rejecting unknown, editorial-only, noncommercial, and ripped sources.

## Caught Issues

- The first ledger exists at `docs/assets/source-ledger.json`; future imports must update it and pass `npm run validate:assets`.

## Next Handoff Notes

- Asset registry and QA agents should read `docs/assets/source-ledger.json` as the source of truth for file hashes and licensing.
