## ADDED Requirements

### Requirement: Auto-group clusters photos by spatial proximity
The system SHALL cluster a user's ungrouped photos using PostGIS `ST_ClusterDBSCAN` with an epsilon of approximately 50km (`50 * 0.009` degrees) and `minpoints = 1` so that every photo is assigned to a spatial cluster. The `location` column SHALL be cast to `geometry` (via `::geometry`) before being passed to `ST_ClusterDBSCAN`, `ST_Y`, and `ST_X` to ensure compatibility regardless of the column's stored type.

#### Scenario: Photos clustered by proximity
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked for a user with ungrouped photos at various locations
- **THEN** photos within ~50km of each other SHALL be grouped into the same spatial cluster

#### Scenario: Isolated photo forms its own cluster
- **WHEN** a photo's location is more than 50km from all other ungrouped photos
- **THEN** that photo SHALL form its own single-photo spatial cluster

#### Scenario: Location column cast to geometry for PostGIS functions
- **WHEN** the clustering query calls `ST_Y`, `ST_X`, or `ST_ClusterDBSCAN` on `Photos.location`
- **THEN** the column SHALL be cast as `location::geometry` in the SQL

### Requirement: Auto-group sub-clusters spatially grouped photos by temporal gaps
Within each spatial cluster, the system SHALL sort photos by `createdAt` and split them into temporal sub-clusters whenever the gap between consecutive photos exceeds 30 days.

#### Scenario: Photos at same location months apart
- **WHEN** a spatial cluster contains photos from June 2024 and December 2024
- **THEN** they SHALL be split into two separate temporal sub-clusters

#### Scenario: Photos at same location within 30 days
- **WHEN** a spatial cluster contains photos all taken within a 30-day window
- **THEN** they SHALL remain in a single sub-cluster

### Requirement: Auto-group only processes ungrouped photos
The system SHALL only process active photos that are NOT already associated with any wave via `WavePhotos`. Photos already in a wave SHALL be excluded from clustering.

#### Scenario: Previously grouped photos excluded
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked and some photos are already in waves
- **THEN** only photos with no `WavePhotos` record SHALL be clustered

#### Scenario: Idempotent re-invocation
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked a second time after a previous successful run with no new photos
- **THEN** no new waves SHALL be created and the result SHALL indicate zero photos grouped

### Requirement: Auto-group creates a wave for each cluster
The system SHALL create **at most one** Wave record per invocation of `autoGroupPhotosIntoWaves(uuid)`. It SHALL run the full clustering pipeline (spatial DBSCAN + temporal gap splitting), sort the resulting temporal clusters by `earliestDate` ascending, and create a Wave for only the **first** (oldest) cluster. The Wave SHALL be owned by the requesting user (`createdBy = uuid`), SHALL have its location set to the centroid of the cluster's photos, and SHALL have the user auto-added to `WaveUsers`. The mutation result SHALL include the created wave's `waveUuid` and `name`. When no ungrouped photos exist, `waveUuid` and `name` SHALL be null. After creating the wave, the system SHALL count remaining ungrouped photos and return `hasMore` and `photosRemaining` so the client can call again.

#### Scenario: One wave created per invocation
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked and clustering produces 5 temporal clusters
- **THEN** exactly one Wave SHALL be created for the cluster with the oldest `earliestDate`

#### Scenario: Wave created for oldest cluster
- **WHEN** clusters exist from 2023, 2024, and 2025
- **THEN** the 2023 cluster SHALL be processed first

#### Scenario: All cluster photos associated with the wave
- **WHEN** a Wave is created for a cluster
- **THEN** a `WavePhotos` record SHALL be inserted for every photo in that cluster

#### Scenario: Result includes wave identity
- **WHEN** `autoGroupPhotosIntoWaves` creates a wave
- **THEN** the result SHALL include `waveUuid` (the UUID of the created wave) and `name` (the generated wave name)

#### Scenario: No wave created returns null identity
- **WHEN** `autoGroupPhotosIntoWaves` is called and the user has no ungrouped photos with locations
- **THEN** the result SHALL have `waveUuid: null` and `name: null`

#### Scenario: Result indicates more photos remain
- **WHEN** a wave is created and ungrouped photos still exist
- **THEN** the result SHALL have `hasMore: true` and `photosRemaining` set to the count of remaining ungrouped photos

#### Scenario: Result indicates completion
- **WHEN** a wave is created and no ungrouped photos remain afterward
- **THEN** the result SHALL have `hasMore: false` and `photosRemaining: 0`

#### Scenario: No ungrouped photos exist
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked and no ungrouped photos exist
- **THEN** the result SHALL have `photosGrouped: 0`, `hasMore: false`, and `photosRemaining: 0`

#### Scenario: Idempotent re-invocation
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked a second time after all photos have been grouped with no new photos
- **THEN** no new waves SHALL be created and the result SHALL indicate zero photos grouped with `hasMore: false`

### Requirement: Auto-group names waves using reverse geocoding and date range
The system SHALL name each auto-created wave using the pattern `"<Location>, <DateRange>"` where Location is the city or area name from reverse geocoding the cluster centroid, and DateRange reflects the timespan of photos in the cluster.

#### Scenario: Single-month wave naming
- **WHEN** a cluster's photos span June 1–25, 2024 near Paris
- **THEN** the wave name SHALL be `"Paris, Jun 2024"`

#### Scenario: Multi-month same-year wave naming
- **WHEN** a cluster's photos span June–August 2024 near Tokyo
- **THEN** the wave name SHALL be `"Tokyo, Jun – Aug 2024"`

#### Scenario: Cross-year wave naming
- **WHEN** a cluster's photos span December 2023 to January 2024 near London
- **THEN** the wave name SHALL be `"London, Dec 2023 – Jan 2024"`

#### Scenario: Single-day wave naming
- **WHEN** a cluster contains photos all from June 15, 2024 near Rome
- **THEN** the wave name SHALL be `"Rome, Jun 15, 2024"`

#### Scenario: Geocoding failure fallback
- **WHEN** reverse geocoding fails for a cluster centroid
- **THEN** the wave name SHALL fall back to a coordinate-based name (e.g., `"40.7°N 74.0°W, Jun 2024"`)

### Requirement: Auto-group uses Nominatim for reverse geocoding
The system SHALL use the OpenStreetMap Nominatim API (`https://nominatim.openstreetmap.org/reverse`) with `zoom=10` for city-level granularity. Requests SHALL include a descriptive `User-Agent` header. Requests SHALL be rate-limited to at most 1 per second.

#### Scenario: Successful reverse geocoding
- **WHEN** the cluster centroid is at latitude 40.6892, longitude -74.0445
- **THEN** the system SHALL call Nominatim with `lat=40.6892&lon=-74.0445&zoom=10&format=json` and extract the city/area name from the response

#### Scenario: Rate limiting between requests
- **WHEN** multiple clusters need geocoding
- **THEN** the system SHALL wait at least 1 second between consecutive Nominatim API calls

### Requirement: Auto-group returns a summary result
The mutation SHALL return an `AutoGroupResult` object including `photosGrouped: Int!` (photos grouped in this invocation), `photosRemaining: Int!` (ungrouped photos remaining), `hasMore: Boolean!` (whether the client should call again), `waveUuid: String` (UUID of created wave, null if none), and `name: String` (name of created wave, null if none).

#### Scenario: Successful grouping result
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` creates a wave covering 15 photos with 50 remaining
- **THEN** the result SHALL contain `{ photosGrouped: 15, photosRemaining: 50, hasMore: true, waveUuid: "<uuid>", name: "<name>" }`

#### Scenario: No ungrouped photos
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked but the user has no ungrouped photos
- **THEN** the result SHALL contain `{ photosGrouped: 0, photosRemaining: 0, hasMore: false, waveUuid: null, name: null }`

### Requirement: AutoGroupResult includes continuation fields
The `AutoGroupResult` GraphQL type SHALL include `photosRemaining: Int!` (count of ungrouped photos after this invocation) and `hasMore: Boolean!` (whether the client should call again).

#### Scenario: GraphQL type shape
- **WHEN** the client queries `autoGroupPhotosIntoWaves`
- **THEN** the response SHALL include `photosGrouped`, `photosRemaining`, `hasMore`, `waveUuid`, and `name`

#### Scenario: Client loops until done
- **WHEN** the client calls `autoGroupPhotosIntoWaves` and receives `hasMore: true`
- **THEN** the client SHALL call again to process the next cluster
