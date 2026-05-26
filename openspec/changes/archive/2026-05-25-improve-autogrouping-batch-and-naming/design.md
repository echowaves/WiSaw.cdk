## Context

`autoGroupPhotosIntoWaves` processes ungrouped photos in batches of `BATCH_LIMIT` (currently 200). Each batch fetches ungrouped photos ordered by `createdAt ASC`, groups matching ones into a wave, and skips non-matching ones. The client must call repeatedly while `hasMore=true`.

Wave names are derived from the most-frequent locality across all photos in the wave. Null-locality photos are stored in the frequency map as `"unknown"`. When null-locality photos outnumber real ones (common with distance-fallback grouping), the wave name becomes "unknown, Season Year".

## Goals / Non-Goals

**Goals:**
- Reduce client round trips by processing up to 1000 photos per invocation
- Produce meaningful wave names whenever any photo in the wave has locality data

**Non-Goals:**
- Adding reverse geocode calls during auto-grouping (explicitly prohibited by spec)
- Changing MAX_PHOTOS_PER_WAVE
- Fixing existing wave names in the database (would need a separate migration/script)

## Decisions

### Decision: Set BATCH_LIMIT to 1000 (matching MAX_PHOTOS_PER_WAVE)

**Choice**: Change `const BATCH_LIMIT = 200` to `const BATCH_LIMIT = 1000`.

**Rationale**: With no geocoding calls during auto-grouping, per-photo cost is minimal (in-memory string comparison + one bulk DB query for distance fallback + one bulk INSERT). 1000 photos is well within Lambda memory and AppSync's 30-second timeout. Aligning with MAX_PHOTOS_PER_WAVE means most waves fill in a single invocation.

**Alternatives considered**:
- *500 as a middle ground* — no clear benefit over 1000 since the workload scales linearly and is lightweight
- *Dynamic batch size* — overengineered for this use case

### Decision: Skip "unknown" entries in getMostFrequentLocality

**Choice**: In `getMostFrequentLocality`, skip entries where the key is `"unknown"`. If all entries are "unknown", return `null`, which falls through to `coordinateFallbackName`.

**Rationale**: "unknown" is a sentinel for null-locality photos, not a real place name. Even if only 10% of photos have locality data, that's a better name than "unknown". This approach requires no schema changes and no additional DB queries.

**Alternatives considered**:
- *Don't insert "unknown" into the map at all* — would require changes throughout the frequency tracking code; skipping at read time is simpler and equally effective
- *Use a separate counter for null-locality photos* — more complex, same result

## Risks / Trade-offs

- **[Risk] Larger batch increases Lambda execution time** → Mitigated: no geocoding calls, workload is DB-bound. A 1000-photo batch with one `_filterPhotosInRadius` query and one bulk INSERT should complete well under 30 seconds
- **[Risk] All photos null-locality → name falls back to coordinates** → This is correct behavior; coordinate fallback is the right name when no locality data exists
