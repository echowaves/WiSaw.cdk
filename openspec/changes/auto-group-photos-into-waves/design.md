## Context

The app stores user photos with PostGIS `POINT` locations and timestamps. Waves are named collections that group photos. Currently waves must be created manually. The `listPhotoLocations` controller already demonstrates spatial clustering using `ST_ClusterDBSCAN` to find photo clusters not yet assigned to any wave. This new Lambda extends that pattern to automatically create waves and assign photos for a given user.

Key existing infrastructure:
- `ST_ClusterDBSCAN` spatial clustering in `listPhotoLocations.ts`
- Wave CRUD operations in `lambda-fns/controllers/waves/`
- `WavePhotos` junction table with `(waveUuid, photoId)` composite key
- `ManagedServerlessClient` for database access via `psql.ts`
- `NodejsFunction` CDK pattern for Lambda deployment

## Goals / Non-Goals

**Goals:**
- Every ungrouped photo for a user gets assigned to exactly one wave after invocation
- Minimize the number of waves created by using intelligent spatial + temporal clustering
- Wave names describe location and time range (e.g., "Brooklyn, Jun 2024" or "Paris, Dec 2023 – Jan 2024")
- Idempotent — running again only processes newly ungrouped photos
- Accessible via a GraphQL mutation so the client can trigger it

**Non-Goals:**
- Real-time auto-grouping on photo upload (this is a batch operation, triggered on demand)
- Merging or splitting existing waves
- Supporting multi-user waves (each auto-generated wave belongs to the requesting user)
- Custom clustering parameters from the user (use sensible defaults)

## Decisions

### 1. Two-phase clustering: spatial first, then temporal sub-clustering
**Decision**: First cluster photos by spatial proximity using `ST_ClusterDBSCAN(location, eps, minpoints)`, then within each spatial cluster, sub-cluster by temporal gaps (photos more than 30 days apart form separate time groups).
**Rationale**: Pure spatial clustering groups photos from the same location taken years apart. Pure temporal clustering groups photos from a single trip across multiple cities. The hybrid approach produces intuitive groupings — "that trip to Paris" or "photos near home this month."
**Alternative considered**: Single-pass clustering with a combined spatiotemporal distance metric — rejected because PostGIS `ST_ClusterDBSCAN` only works on geometry, and mixing units (meters vs. seconds) requires arbitrary weighting.

### 2. Reverse geocoding via OpenStreetMap Nominatim
**Decision**: Use OpenStreetMap Nominatim (`https://nominatim.openstreetmap.org/reverse`) to convert cluster centroid coordinates into location names. Call with `zoom=10` (city-level granularity). Cache results within the Lambda invocation to avoid redundant calls for nearby clusters.
**Rationale**: Free, no AWS service setup, sufficient for batch naming. Rate limited to 1 req/sec, which is fine for sequential cluster processing.
**Alternative considered**: AWS Location Service — rejected because it adds infrastructure cost and CDK complexity for a simple reverse geocoding need. Can migrate later if Nominatim proves unreliable.
**Alternative considered**: No geocoding, use lat/lon in wave names — rejected as user-unfriendly.

### 3. Wave name format: "Location, DateRange"
**Decision**: Wave names follow the pattern `"<City/Area>, <DateRange>"`. Date range format:
- Single month: `"Jun 2024"`
- Multi-month same year: `"Jun – Aug 2024"`
- Cross-year: `"Dec 2023 – Jan 2024"`
- Single day: `"Jun 15, 2024"`
**Rationale**: Concise, human-readable, matches how people mentally organize trips and time periods.

### 4. Clustering parameters: 50km spatial radius, 30-day temporal gap
**Decision**: Use `eps = 50 * 0.009` degrees (~50km) for spatial clustering with `minpoints = 1` (every photo gets clustered). Temporal sub-clustering splits when the gap between consecutive photos exceeds 30 days.
**Rationale**: 50km captures a metropolitan area or resort region. 30 days distinguishes separate trips or seasons. These match the existing `radius` default (50) in the Wave model. The `minpoints = 1` ensures no photos are left as noise.

### 5. Execute as a standalone Lambda invoked via AppSync mutation
**Decision**: The auto-grouping runs as an AppSync-triggered mutation (`autoGroupPhotosIntoWaves`) routed through the main AppSync Lambda. This keeps it in the existing resolver dispatch pattern.
**Rationale**: Consistent with all other wave operations. No new infrastructure (no EventBridge, no Step Functions). The operation is bounded per-user so a single Lambda invocation with adequate timeout suffices.
**Alternative considered**: Standalone Lambda with EventBridge scheduled trigger — rejected because grouping should be user-initiated, not periodic.

### 6. Process entirely in SQL + application logic, no new tables
**Decision**: The clustering query runs in SQL (leveraging `ST_ClusterDBSCAN`), temporal sub-clustering and naming happen in application code, and wave/photo inserts use existing `Waves` + `WavePhotos` tables. No new database tables or migrations needed.
**Rationale**: The existing schema supports the feature fully. The `WavePhotos` junction table with `ON CONFLICT DO NOTHING` makes inserts idempotent.

### 7. Lambda timeout and memory allocation
**Decision**: Set timeout to 300 seconds and memory to 512MB. A user with 10,000 photos would produce a manageable number of clusters, and the heaviest operations are the initial SQL query and sequential Nominatim calls.
**Rationale**: The SQL clustering is O(n log n) in PostGIS. Reverse geocoding is sequential at 1/sec but bounded by the number of clusters (typically 10–200). 300s provides headroom for power users with many distinct clusters. 512MB is sufficient for JSON manipulation in Node.js.

## Risks / Trade-offs

- **[Nominatim rate limiting]** → Mitigated by processing clusters sequentially with 1-second delays between geocoding calls. Cluster count is small (not per-photo).
- **[Nominatim unavailability]** → Mitigated by falling back to coordinate-based names (e.g., "40.7°N 74.0°W, Jun 2024") if geocoding fails.
- **[Very large photo sets]** → Mitigated by 300s Lambda timeout. If a user has 100k+ photos, the SQL query might be slow. Could add pagination in a future iteration, but this is an edge case for the current user base.
- **[Duplicate wave names]** → If a user runs auto-group, takes more photos at the same place, and runs again, a second wave with a similar name could be created. Acceptable since waves have UUIDs and users can rename/delete.
- **[Nominatim usage policy]** → Nominatim requires a User-Agent header and has a usage policy. Mitigated by setting a descriptive User-Agent and keeping request volume low (batch, not real-time).

## Open Questions

- Should the mutation return the list of created waves, or just a count/success boolean? (Proposing: return created wave count and total photos grouped for simplicity)
