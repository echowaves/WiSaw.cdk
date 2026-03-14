## Context

The current `autoGroupPhotosIntoWaves` has grown to ~480 lines with 10 functions, 4 interfaces, and duplicated logic across two separate flows (located photos in `main()` vs locationless photos in `handleUnresolvablePhotos()`). The client can't distinguish "new wave created" from "photos absorbed into existing wave," causing duplicate key crashes.

## Goals / Non-Goals

**Goals:**
- Fix the duplicate key error by adding `isNewWave` to the API contract
- Reduce code complexity by eliminating duplication and unnecessary abstractions
- Maintain the same grouping behavior: spatial clustering → temporal splitting → geocode → absorb fallback

**Non-Goals:**
- Changing the clustering algorithm (DBSCAN, 50km epsilon, 30-day gap)
- Modifying the client (separate repo)

## Design

### API Change

Add `isNewWave: Boolean!` to `AutoGroupResult`:

```graphql
type AutoGroupResult {
  waveUuid: String
  name: String
  photosGrouped: Int!
  photosRemaining: Int!
  hasMore: Boolean!
  isNewWave: Boolean!
}
```

Return values by path:

| Path | isNewWave | waveUuid | name |
|------|-----------|----------|------|
| Geocode success → create wave | `true` | new UUID | location + date |
| Geocode fail → absorb into existing | `false` | null | null |
| Geocode fail → no existing waves → create "Uncategorized" | `true` | new UUID | "Uncategorized, ..." |
| Locationless → absorb into existing | `false` | null | null |
| Locationless → no existing waves → create "Uncategorized" | `true` | new UUID | "Uncategorized, ..." |
| Nothing to process | `false` | null | null |

On absorb paths, `waveUuid` returns to `null` — the client doesn't need it since `isNewWave: false` means "don't add to list."

### Code Simplification

**Remove `UngroupedPhoto` interface** — use `{ id: string, createdAt: string }` directly or use a single `Photo` type with optional lat/lon.

**Remove `splitUngroupedByTemporalGaps`** — merge into a single generic `splitByTemporalGaps` that works on `{ id, createdAt }[]`.

**Remove `primaryWaveUuid`/`primaryWaveName` tracking from `assignPhotosToNearestWave`** — return just `number` (count of assigned). No longer needed since absorb paths return `isNewWave: false` with null waveUuid.

**Inline `handleUnresolvablePhotos` into `main()`** — the two flows share the same fallback logic (absorb → uncategorized). After processing located photos, handle locationless ones in the same function.

### Simplified Structure

```
main(uuid)
  ├→ validate + connect
  ├→ DBSCAN spatial clustering query (located photos only)
  ├→ IF located photos found:
  │   ├→ group by cluster_id → split by temporal gaps → pick oldest
  │   ├→ reverseGeocode(centroid)
  │   ├→ IF geocode success → createWaveAndAssign() → return isNewWave: true
  │   ├→ IF geocode fail + existing waves → assignPhotosToNearestWave() → return isNewWave: false
  │   └→ IF geocode fail + no waves → createWaveAndAssign("Uncategorized") → return isNewWave: true
  └→ IF no located photos (locationless only):
      ├→ query locationless ungrouped photos
      ├→ IF none → return photosGrouped: 0
      ├→ IF existing waves → assignPhotosToNearestWave() → return isNewWave: false
      └→ IF no waves → split by temporal gaps → createWaveAndAssign("Uncategorized") → return isNewWave: true
```

Functions retained: `reverseGeocode`, `formatDateRange`, `splitByTemporalGaps` (unified), `buildTemporalCluster`, `countRemainingUngrouped`, `assignPhotosToNearestWave` (simplified), `createWaveAndAssign`, `main`.

Functions removed: `splitUngroupedByTemporalGaps`, `handleUnresolvablePhotos`.
Interfaces removed: `UngroupedPhoto`.
