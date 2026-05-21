## Context

The `autoGroupPhotosIntoWaves` mutation groups a user's ungrouped photos into waves based on reverse-geocoded locality fields. Currently it uses strict string equality on anchor fields (`anchorLocality`, `anchorRegion`, `anchorCountry`, etc.) to decide whether a photo fits a wave. This causes two problems:

1. **Too-small waves**: When the reverse geocoder returns inconsistent strings for nearby locations (e.g., "Paris" vs "Paris 9e Arrondissement") or when geocoding fails (empty strings normalized to null), photos that should group together are split into single-photo or few-photo waves — even at REGION or COUNTRY level.

2. **Timeout on large backlogs**: The mutation processes ALL ungrouped photos in a single invocation with no LIMIT, issuing at least 2 DB queries per photo (INSERT + increment). For users with thousands of ungrouped photos this exceeds the 30-second Lambda timeout.

The existing `AutoGroupResult` return type already has `hasMore` and `photosRemaining` fields, but they are hardcoded to `false` and `0`.

## Goals / Non-Goals

**Goals:**
- Photos within geographic proximity are grouped together even when geocoded strings don't match exactly
- The mutation completes within Lambda timeout regardless of ungrouped photo count
- The frequency map state is correctly scoped to individual waves
- Reduce per-photo DB round-trips during processing

**Non-Goals:**
- Changing the GraphQL schema or API contract (the existing fields are sufficient)
- Changing how waves are named (the locality-frequency refinement stays)
- Re-geocoding photos during auto-grouping (all geo data comes from DB)
- Centroid-based or drifting anchor points (anchor stays at wave's first photo)

## Decisions

### Decision 1: Spatial distance fallback via Haversine in JS

**Choice**: Add a Haversine distance check as a fallback when string matching fails in `fitsPhotoInWave`.

**Why**: Both photo coordinates and wave anchor coordinates are already available in memory — the photo query returns `lat`/`lon` and the wave has a `location` point. Haversine is a ~10 line pure function, no new dependencies, no extra DB queries.

**Alternatives considered**:
- *PostGIS `ST_DWithin` in SQL*: Would require restructuring the query to join against the wave's location. More accurate (geodesic vs spherical) but adds query complexity and DB load. The precision difference is negligible for the thresholds involved.
- *Fuzzy string matching (Levenshtein)*: Doesn't help with geocoding failures (empty strings), and risks false positives across locations with similar names in different regions (e.g., "Springfield, IL" vs "Springfield, MA").
- *Pure spatial clustering (DBSCAN in SQL)*: Already exists in `listPhotoLocations.ts`. Would be a major rewrite, loses chronological ordering and the anchor-refinement logic.

**Thresholds per grouping level**:

| Level | Max Distance | Rationale |
|---|---|---|
| DISTRICT | 15 km | Covers urban district variation |
| CITY | 50 km | Covers metro area + suburbs |
| REGION | 300 km | Covers a typical state/province |
| COUNTRY | 2000 km | Covers medium-to-large countries |

The matching logic becomes: `stringMatch(photo, wave, level) || withinDistance(photo, anchor, threshold)`.

### Decision 2: Batch processing with LIMIT

**Choice**: Add `LIMIT 200` to the ungrouped photos query. After processing, run a second COUNT query to populate `photosRemaining` and `hasMore`.

**Why**: 200 photos at ~2 queries each = ~400 queries max, completing well within 30 seconds. The client already handles `hasMore` semantically — it just needs to call in a loop.

**Alternatives considered**:
- *Larger LIMIT (500-1000)*: Risks approaching timeout for worst-case (many wave boundaries).
- *Time-based cutoff*: Check elapsed time and break early. Harder to reason about, non-deterministic batch sizes.

### Decision 3: Reset frequency maps at wave boundary

**Choice**: Clear `localityCounts`, `districtCounts`, `regionCounts`, `countryCounts`, `districtMap`, `regionMap`, `countryMap` when creating a new wave.

**Why**: Currently these maps accumulate across waves within a single invocation. When the algorithm creates wave 2, the refinement logic still contains locality counts from wave 1, potentially selecting the wrong dominant locality for wave 2's name and anchor fields.

### Decision 4: Bulk INSERT for WavePhotos

**Choice**: Accumulate photo IDs while iterating, then INSERT all photos for a wave in a single multi-row `INSERT INTO "WavePhotos" ... VALUES (...), (...), (...)` statement instead of one INSERT per photo.

**Why**: Reduces DB round-trips from O(N) to O(1) per wave. The `_incrementPhotosCount` calls can also be replaced by a single `_updatePhotosCount` at the end.

**Risk**: Must handle the wave-boundary case — when the algorithm switches to a new wave, flush the accumulated batch for the previous wave before starting the new one.

## Risks / Trade-offs

- **[Distance fallback may over-group]** → Photos in different cities within the distance threshold could be grouped together even though they have distinct locality names. Mitigation: String matching is the primary path; distance is only the fallback. At CITY level, 50 km is conservative.
- **[Batch size may need tuning]** → 200 is an estimate. If most photos create new waves (worst case with lots of fragmentation), 200 × 5-6 queries = 1000-1200 queries. Mitigation: Monitor Lambda execution times and adjust. The spatial distance fallback should dramatically reduce wave splits.
- **[Client must handle looping]** → The client needs to call the mutation repeatedly when `hasMore` is true. Mitigation: This is already the designed contract per the `AutoGroupResult` type.
