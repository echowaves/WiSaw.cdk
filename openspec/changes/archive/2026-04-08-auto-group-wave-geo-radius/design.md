## Context

Auto-grouped waves are created by `autoGroupPhotosIntoWaves.ts`. It collects photos within `DISTANCE_THRESHOLD_KM = 100` km of an anchor photo, then creates a wave with `radius = 100` hardcoded. The `haversineDistance` function already exists in the file for the collection step. The wave's `radius` column is used by `_assertGeoBounds` (via `ST_DWithin` with `radius * 1000` meters) to enforce geo-fencing when photos are added. Auto-grouped waves are frozen by design, so the geo-fence only matters if someone later unfreezes the wave.

## Goals / Non-Goals

**Goals:**
- Compute wave radius from the actual max distance between the anchor and any collected geolocated photo
- Apply a minimum radius floor so single-photo or tight clusters get a usable fence
- Apply a buffer margin so photos near the edge aren't immediately outside the fence

**Non-Goals:**
- Changing the wave location from anchor to centroid
- Changing the collection threshold (`DISTANCE_THRESHOLD_KM`)
- Modifying the `_assertGeoBounds` logic

## Decisions

**Compute radius using existing `haversineDistance` rather than PostGIS**

The collected photos array with their lat/lon is already in memory. Iterating it to find the max distance from the anchor is trivial (O(n), n ≤ 1000) and reuses the existing `haversineDistance` helper. No extra SQL round-trip needed.

Alternative: PostGIS `ST_MaxDistance` — rejected because it requires the photo IDs to be in the DB already (they aren't grouped into the wave yet at computation time), the data is already in memory, and it adds query complexity for no benefit.

**Minimum radius floor of 5km**

A cluster with a single geolocated photo has max distance = 0. A floor of 5km ensures a meaningful geo-fence. This is small enough to represent a neighbourhood-scale area.

**Buffer of 20% with a 10km minimum buffer**

`radius = max(maxDistance * 1.2, maxDistance + 10, 5)`. The 20% handles large clusters (100km spread → 120km radius). The 10km minimum buffer handles small clusters where 20% is negligible (e.g. 2km spread → 12km radius, not 2.4km). The 5km floor catches the zero-distance case.

## Risks / Trade-offs

[Existing auto-grouped waves keep hardcoded radius] → Accepted. This is a forward-only change; existing waves are not retroactively updated. Their radius of 100km remains. This is fine since they're frozen.
