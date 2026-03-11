## Context

`autoGroupPhotosIntoWaves` currently processes all ungrouped photos in one Lambda invocation: spatial clustering via `ST_ClusterDBSCAN`, temporal sub-clustering, reverse geocoding (1 second delay per Nominatim call), and wave/photo inserts. For users with many photos spanning many locations, the sequential geocoding alone can exceed the AppSync 30-second timeout (e.g., 20 distinct locations = 20+ seconds just for geocoding).

## Goals / Non-Goals

**Goals:**
- Eliminate execution timeouts by processing exactly one wave per invocation
- Give clients enough information (`hasMore`, `photosRemaining`) to loop until complete
- Process oldest photos first so the grouping is deterministic and progressive

**Non-Goals:**
- Changing the clustering algorithm (DBSCAN spatial + temporal gap splitting stays the same)
- Batch/background processing or queuing — the client drives the loop
- Optimizing the Nominatim geocoding delay (stays at 1 second)

## Decisions

### Decision: Run the full clustering query each invocation, but only create one wave

**Rationale**: The clustering query itself is fast (milliseconds). The expensive part is geocoding + DB writes per wave. Re-running clustering each time ensures correctness — photos grouped in the previous call are excluded via the `LEFT JOIN WavePhotos IS NULL` filter. This avoids any need for server-side cursor/state between calls.

**Alternative considered**: Store clustered results and paginate through them — rejected because it requires server-side state or a temporary table, and the clustering result changes as photos get grouped.

### Decision: Sort temporal clusters by `earliestDate` ascending and pick the first

**Rationale**: Processing oldest photos first gives deterministic, predictable ordering. The client sees the user's photo history being grouped chronologically.

### Decision: Count remaining ungrouped photos with a separate query after wave creation

**Rationale**: After creating the wave and associating its photos, a simple `COUNT(*)` of ungrouped photos gives an accurate `photosRemaining`. This is cheaper than re-running clustering and avoids returning stale data.

## Risks / Trade-offs

- [Re-running clustering each call] → Marginal overhead (query is fast), but guarantees correctness without server-side state
- [Client must loop] → Simple to implement on client side; each call is idempotent and safe to retry
- [BREAKING API change] → New fields added to `AutoGroupResult`; existing `wavesCreated` stays but will always be 0 or 1 per call
