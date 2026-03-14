## Context

The `autoGroupPhotosIntoWaves` mutation clusters a user's ungrouped photos spatially (DBSCAN, ~50km) then temporally (30-day gaps), creates one wave per invocation for the oldest cluster, and names it via Nominatim reverse geocoding. Two problems exist:

1. **Nominatim returns local-language names** (e.g., Japanese for Tokyo, Cyrillic for Moscow) because no `accept-language` parameter is sent.
2. **Photos without GPS location are permanently excluded** — the clustering query filters `location IS NOT NULL`, and so does the remaining-count query, making locationless photos invisible.

Only one file is affected: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`.

## Goals / Non-Goals

**Goals:**
- Wave names always use English place names regardless of country
- Every ungrouped photo (with or without location) eventually gets assigned to a wave
- Locationless photos are assigned to the wave whose time range is nearest to the photo's `createdAt`

**Non-Goals:**
- Multi-language support / user-selectable locale for wave names
- Changing the spatial clustering algorithm or parameters
- Re-naming existing waves that were already created with local-language names
- Changing the GraphQL schema or `AutoGroupResult` type

## Decisions

### Decision 1: Force English via `accept-language=en`

Add `&accept-language=en` to the Nominatim reverse geocoding URL. Nominatim supports this parameter to return place names in the requested language, falling back to the local name only when no English translation exists.

**Alternative considered**: Store both local and English names — rejected as over-engineering for the current need.

### Decision 2: Assign unresolvable photos after all spatial clusters are exhausted

A photo is "unresolvable" if it has no GPS location OR if its spatial cluster's centroid fails reverse geocoding (Nominatim returns no location name). Both cases are handled identically — assigned to the nearest wave in time.

Processing order within `autoGroupPhotosIntoWaves`:

1. Spatial clustering runs only on photos with a location. For each cluster, attempt reverse geocoding.
   - If geocoding succeeds → create a named wave (existing behavior).
   - If geocoding fails → do NOT create a coordinate-named wave. Instead, mark these photos as "unresolvable" and skip the cluster. They will be handled in step 2.
2. If no more spatial clusters remain (or all remaining clusters failed geocoding), gather all unresolvable photos (locationless + geocoding-failed) and assign each to the existing wave whose date range is nearest in time, then return `hasMore: false`.
3. If no spatial clusters remain and no unresolvable photos exist → return `hasMore: false` (existing behavior).

**Why wait?** Assigning unresolvable photos before all spatial clusters are processed could put them in a suboptimal wave — a later invocation might create a closer wave. By waiting until spatial clustering is complete, we guarantee the best time-proximity match across all the user's waves.

**Time distance calculation**: For each unresolvable photo, compute the absolute time difference between the photo's `createdAt` and each wave's midpoint (`(earliestDate + latestDate) / 2`). Assign to the wave with the smallest distance. Using the midpoint (rather than nearest edge) keeps the logic simple and produces intuitive results.

### Decision 3: Create a catch-all wave when no waves exist

If a user has only unresolvable photos (locationless or geocoding-failed) and no waves at all, create a wave named `"Uncategorized, <DateRange>"` using the same temporal splitting logic (30-day gaps). This prevents unresolvable photos from being permanently orphaned.

### Decision 4: Update `photosRemaining` to include all ungrouped photos

Remove the `location IS NOT NULL` filter from the remaining-count query so all ungrouped photos are counted (including locationless ones and those whose clusters failed geocoding). This ensures the client continues calling `autoGroupPhotosIntoWaves` until all photos are handled.

## Risks / Trade-offs

- **[English names may be less accurate for some locations]** → Nominatim's English translations are generally good for cities/towns but may fall back to local names for very small villages. Acceptable — coordinate fallback already handles unknown locations.
- **[Existing waves keep local-language names]** → Only newly created waves get English names. Previously created waves are not renamed. This is acceptable to avoid a migration and preserve user edits.
- **[Unresolvable photos assigned to temporally nearest wave may be geographically unrelated]** → This is the expected trade-off. Without a usable location name, time proximity is the best available signal. Users can manually move photos between waves if needed.
- **[Catch-all "Uncategorized" wave is a new naming pattern]** → Replaces the old coordinate-based fallback (`"40.7°N 74.0°W"`), which produced unhelpful wave names. `"Uncategorized"` is clearer.
- **[Geocoding-failed clusters are deferred, not immediately processed]** → A cluster that fails geocoding on one invocation won't be retried on the next. Its photos go to the time-nearest wave once all geocodable clusters are done. This is acceptable since Nominatim failures are typically persistent (ocean points, unpopulated areas).
