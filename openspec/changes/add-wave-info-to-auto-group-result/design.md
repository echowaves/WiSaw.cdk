## Context

`autoGroupPhotosIntoWaves` currently returns `{ photosGrouped, photosRemaining, hasMore }`. The client needs to know the `waveUuid` and `name` of the wave that was just created so it can display it immediately without a separate query. The controller already has both values available at the point of return.

## Goals / Non-Goals

**Goals:**
- Return `waveUuid` and `name` from `AutoGroupResult` so the client can reference the created wave

**Non-Goals:**
- Returning additional wave metadata (location, radius, photo list)
- Changing the mutation signature or input parameters

## Decisions

- **Nullable fields**: `waveUuid` and `name` are `String` (nullable) in GraphQL because the zero-photos early-return path creates no wave. Alternative: make them non-nullable and return empty strings — rejected because null semantics are clearer.
- **No additional query**: The controller already has `waveUuid` and `waveName` in local variables; we simply include them in the return object. No extra DB query needed.

## Risks / Trade-offs

- [Minimal risk] Adding nullable fields is a non-breaking GraphQL schema change — existing clients that don't query these fields are unaffected.
