## Why

Auto-grouping currently uses an `isActive` flag as a cursor to track which wave is being filled. This creates two problems: (1) when photos from the same locality arrive in non-contiguous batches (e.g., NYC → LA → NYC), the second NYC batch creates a duplicate wave instead of adding to the existing one; (2) the `isActive` flag can become stale, which previously caused an infinite loop bug (fixed with a workaround, but the root cause remains).

## What Changes

- Replace the `isActive`-based cursor model with a search-based approach: before creating a new wave, query existing waves owned by the user for a matching wave (same locality, season, groupingLevel, and room for more photos)
- Use string matching on anchor fields (scoped by groupingLevel) with PostGIS `ST_DWithin` distance fallback to find matching waves
- Pick the most recent matching wave when multiple candidates exist
- When resuming an existing wave, load the full locality frequency distribution from `WavePhotos`→`Photos` so name refinement considers all photos, not just the new batch
- Overflow into a new wave when the matched wave reaches 1000 photos
- Remove the `isActive` column from the `Waves` table and all related code **BREAKING**
- Remove stale wave detection logic (structurally impossible without a persistent cursor)
- Replace the B-tree index on `Waves.location` with a GiST index (the current B-tree is useless for `ST_DWithin` spatial queries)
- Add composite index on `Waves(createdBy, groupingLevel)` for efficient candidate wave lookup

## Capabilities

### New Capabilities

_(none — this modifies existing auto-grouping behavior)_

### Modified Capabilities

- `auto-group-photos`: Algorithm changes from single-cursor model to search-and-reuse model; `isActive` flag removed; wave matching uses existing waves before creating new ones

## Impact

- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — major rewrite of wave selection logic
- `graphql/schema.graphql` — remove `isActive` field from `Wave` type
- `lambda-fns/models/wave.ts` — remove `isActive` field
- New migration to drop `isActive` column, replace location B-tree with GiST, add composite index
- Client apps that read `isActive` from the Wave type will break (field removed)
