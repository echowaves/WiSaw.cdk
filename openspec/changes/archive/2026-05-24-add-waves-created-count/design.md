## Context

The `autoGroupPhotosIntoWaves` mutation processes ungrouped photos chronologically, creating new waves when photos drift geographically or the grouping level changes. The current `AutoGroupResult` returns `isNewWave: Boolean!` which only indicates whether the *last* photo triggered a wave creation — it doesn't tell clients how many waves were created in total during the batch.

## Goals / Non-Goals

**Goals:**
- Report the total number of new waves created per auto-group call via `wavesCreated: Int!`
- Keep implementation minimal — just a counter variable and one schema addition

**Non-Goals:**
- No changes to grouping logic or wave creation behavior
- No database migration (purely API-level)
- No changes to existing fields (`isNewWave`, `photosGrouped`)

## Decisions

1. **Use `Int!` (non-null integer)** — Every auto-group call either creates waves or doesn't; the count is always a concrete number, never absent. This matches the existing pattern of `photosGrouped: Int!` and `photosRemaining: Int!`.

2. **Count only newly created waves** — The counter increments when `createWave()` is called (new wave from scratch). It does NOT count reactivating an existing active wave or deactivating old ones. This aligns with the semantic meaning of "waves created in this batch."

3. **Single counter variable, no per-wave tracking** — We don't need to return a list of created wave UUIDs; just the total count. The existing `waveUuid` field already returns the last-created wave's UUID if clients need that detail.

## Risks / Trade-offs

- **None significant.** This is a read-only addition to an API response with no behavioral changes.
