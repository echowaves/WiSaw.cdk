## Why

`autoGroupPhotosIntoWaves` has two code paths: create a new wave, or absorb photos into an existing wave. The client uses `waveUuid` as a FlatList key and blindly appends every result. On absorb, the returned `waveUuid` belongs to an already-listed wave, causing React duplicate key errors (`.$053e3c6d-...`).

The code has also accumulated unnecessary complexity across 4 sequential changes: duplicate temporal splitting functions for two near-identical types, a separate `handleUnresolvablePhotos` flow that mirrors `main()`, and a `primaryWaveUuid` tracking mechanism that doesn't solve the real problem.

## What Changes

1. **Add `isNewWave: Boolean!` to `AutoGroupResult`** — tells the client whether to append or skip
2. **Merge `UngroupedPhoto` into a simpler photo type** — eliminate duplicate `splitUngroupedByTemporalGaps`
3. **Flatten control flow** — inline `handleUnresolvablePhotos` into `main()`, reducing branching
4. **Simplify `assignPhotosToNearestWave`** — remove `primaryWaveUuid`/`primaryWaveName` tracking (no longer needed since client uses `isNewWave` to decide behavior)

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `auto-group-photos`: Result now includes `isNewWave` flag. Create paths set `true`, absorb paths set `false`. Code simplified from ~480 lines to ~300.

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — rewrite/simplify
- **APIs**: `graphql/schema.graphql` — add `isNewWave: Boolean!` to `AutoGroupResult`
- **Client**: Must check `isNewWave` before appending to wave list (client-side change outside this repo)
