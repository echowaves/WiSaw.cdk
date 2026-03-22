## Why

Users accumulate waves over time — both manually created and auto-grouped. There is currently no way to combine two waves into one. Users need the ability to merge a source wave into a target wave, moving all photos and cleaning up the source, so they can consolidate related content without manually removing and re-adding photos one by one.

## What Changes

- Add a new `mergeWaves` GraphQL mutation that atomically merges a source wave into a target wave
- Photos are moved from source to target (preserving original `createdBy` in WavePhotos)
- WaveUsers from the source are merged into the target (deduplicated)
- The source wave is deleted after merge
- The target wave's `photosCount` is recalculated
- The target wave's metadata (location, radius, createdBy, createdAt) is preserved
- Optionally allows renaming the target wave and updating its description at merge time

## Capabilities

### New Capabilities
- `wave-merge`: Merge two waves into one — move photos, merge users, delete source, optionally rename target

### Modified Capabilities

## Impact

- **GraphQL schema**: New `mergeWaves` mutation added to `schema.graphql`
- **Lambda code**: New controller `lambda-fns/controllers/waves/merge.ts`, new import and resolver wiring in `lambda-fns/index.ts`
- **Database**: No schema changes — operates on existing `Waves`, `WavePhotos`, and `WaveUsers` tables
- **APIs**: Additive change only — no breaking changes to existing mutations or queries
