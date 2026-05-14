## Why

The `autoGroupPhotosIntoWaves` mutation uses a hardcoded 100km threshold for grouping photos. Clients have no way to control grouping granularity — users with dense photo collections may want tighter clusters, while users with sparse collections may want looser grouping. Making the radius configurable lets clients pass a user-tuned value.

## What Changes

- Add optional `radius: Int` parameter to `autoGroupPhotosIntoWaves` mutation
- Default value is 100 (current behavior preserved)
- The radius replaces `DISTANCE_THRESHOLD_KM` as the input controlling which photos are collected
- The wave's stored `radius` field continues to be computed from actual photo spread via `computeClusterRadius()` (unchanged)

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `auto-group-photos`: The `autoGroupPhotosIntoWaves` mutation gains an optional `radius` parameter that controls the maximum haversine distance (in km) from the anchor photo for collecting photos into a wave.

## Impact

- `graphql/schema.graphql` — add `radius: Int` to mutation
- `lambda-fns/index.ts` — update `getArgs` to pass `args.radius`
- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — accept `radius?` param, use it instead of `DISTANCE_THRESHOLD_KM`
- No new dependencies
- No database migration
- Backwards compatible — existing callers get the 100km default
