## MODIFIED Requirements

### Requirement: Auto-group names waves using reverse geocoding and date range
The system SHALL name each auto-created wave using the pattern `"<Location>, <DateRange>"` where Location is the city or area name from reverse geocoding the cluster centroid **in English**, and DateRange reflects the timespan of photos in the cluster. The Nominatim reverse geocoding request SHALL include the parameter `accept-language=en` to ensure English place names are returned.

#### Scenario: Single-month wave naming
- **WHEN** a cluster's photos span June 1–25, 2024 near Paris
- **THEN** the wave name SHALL be `"Paris, Jun 2024"` (in English)

#### Scenario: Multi-month same-year wave naming
- **WHEN** a cluster's photos span June–August 2024 near Tokyo
- **THEN** the wave name SHALL be `"Tokyo, Jun – Aug 2024"` (in English, not Japanese)

#### Scenario: Cross-year wave naming
- **WHEN** a cluster's photos span December 2023 to January 2024 near London
- **THEN** the wave name SHALL be `"London, Dec 2023 – Jan 2024"`

#### Scenario: Single-day wave naming
- **WHEN** a cluster contains photos all from June 15, 2024 near Rome
- **THEN** the wave name SHALL be `"Rome, Jun 15, 2024"` (in English, not Italian)

#### Scenario: Geocoding failure — photos treated as unresolvable
- **WHEN** reverse geocoding fails for a cluster centroid (no location name returned)
- **THEN** the system SHALL NOT create a wave with coordinate-based names; instead, the cluster's photos SHALL be treated as unresolvable and assigned to the nearest wave in time after all geocodable clusters are processed

#### Scenario: English forced for non-Latin script regions
- **WHEN** a cluster centroid is in a country using non-Latin script (e.g., Japan, Russia, China)
- **THEN** the wave name SHALL use the English transliteration of the location name, not the local script

### Requirement: Auto-group only processes ungrouped photos
The system SHALL only process active photos that are NOT already associated with any wave via `WavePhotos`. Photos already in a wave SHALL be excluded from clustering. The spatial clustering query SHALL filter for photos with a non-null location. Photos without a location SHALL be handled in a separate pass after spatial clustering is complete. Photos whose spatial cluster fails reverse geocoding SHALL also be deferred to the same separate pass.

#### Scenario: Previously grouped photos excluded
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked and some photos are already in waves
- **THEN** only photos with no `WavePhotos` record SHALL be clustered

#### Scenario: Idempotent re-invocation
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked a second time after a previous successful run with no new photos
- **THEN** no new waves SHALL be created and the result SHALL indicate zero photos grouped

#### Scenario: Locationless photos excluded from spatial clustering
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` runs the spatial clustering step
- **THEN** only photos with `location IS NOT NULL` SHALL be included in DBSCAN clustering

#### Scenario: Geocoding-failed cluster photos deferred
- **WHEN** a spatial cluster's centroid fails reverse geocoding
- **THEN** the cluster's photos SHALL NOT form a wave and SHALL be deferred to the unresolvable-photo assignment pass

### Requirement: Auto-group creates a wave for each cluster
The system SHALL create **at most one** Wave record per invocation of `autoGroupPhotosIntoWaves(uuid)`. It SHALL run the full clustering pipeline (spatial DBSCAN + temporal gap splitting), sort the resulting temporal clusters by `earliestDate` ascending, and create a Wave for only the **first** (oldest) cluster. The Wave SHALL be owned by the requesting user (`createdBy = uuid`), SHALL have its location set to the centroid of the cluster's photos, and SHALL have the user auto-added to `WaveUsers`. The mutation result SHALL include the created wave's `waveUuid` and `name`. When no ungrouped photos with locations exist and no locationless photos remain, `waveUuid` and `name` SHALL be null. After creating the wave, the system SHALL count remaining ungrouped photos **including those without a location** and return `hasMore` and `photosRemaining` so the client can call again.

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
- **WHEN** `autoGroupPhotosIntoWaves` is called and the user has no ungrouped photos at all (neither located nor locationless)
- **THEN** the result SHALL have `waveUuid: null` and `name: null`

#### Scenario: Result indicates more photos remain
- **WHEN** a wave is created and ungrouped photos still exist (including locationless ones)
- **THEN** the result SHALL have `hasMore: true` and `photosRemaining` set to the count of ALL remaining ungrouped photos (with and without location)

#### Scenario: Result indicates completion
- **WHEN** a wave is created and no ungrouped photos remain afterward (including locationless)
- **THEN** the result SHALL have `hasMore: false` and `photosRemaining: 0`

#### Scenario: No ungrouped photos exist
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked and no ungrouped photos exist
- **THEN** the result SHALL have `photosGrouped: 0`, `hasMore: false`, and `photosRemaining: 0`

#### Scenario: Idempotent re-invocation
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked a second time after all photos have been grouped with no new photos
- **THEN** no new waves SHALL be created and the result SHALL indicate zero photos grouped with `hasMore: false`

## ADDED Requirements

### Requirement: Auto-group assigns unresolvable photos to nearest wave in time
When no more geocodable spatial clusters remain to process, the system SHALL find all ungrouped active photos that are unresolvable (no location OR belonging to a cluster that failed reverse geocoding) and assign each one to the existing wave whose time range is nearest to the photo's `createdAt`. Time distance SHALL be calculated as the absolute difference between the photo's `createdAt` and the wave's date-range midpoint. All unresolvable photos SHALL be assigned in a single invocation.

#### Scenario: Locationless photo assigned to nearest wave
- **WHEN** spatial clustering is complete, a user has 3 waves (Jan 2024, Jun 2024, Dec 2024), and a locationless photo was created on May 15, 2024
- **THEN** the photo SHALL be assigned to the Jun 2024 wave (nearest in time)

#### Scenario: Geocoding-failed photo assigned to nearest wave
- **WHEN** spatial clustering is complete and a cluster's centroid failed reverse geocoding, and the user has existing waves
- **THEN** each photo from the failed cluster SHALL be independently assigned to the wave nearest to its `createdAt`

#### Scenario: Multiple unresolvable photos assigned to different waves
- **WHEN** spatial clustering is complete and a user has unresolvable photos from various dates
- **THEN** each photo SHALL be independently assigned to the wave nearest to its `createdAt`

#### Scenario: Unresolvable photos processed only after geocodable spatial clusters exhausted
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked and geocodable spatial clusters still exist
- **THEN** unresolvable photos SHALL NOT be assigned yet; only the oldest geocodable spatial cluster SHALL be processed

#### Scenario: Result after unresolvable assignment
- **WHEN** unresolvable photos are assigned to existing waves
- **THEN** the result SHALL report the count of assigned photos in `photosGrouped`, `hasMore: false`, and `photosRemaining: 0`

### Requirement: Auto-group creates catch-all wave for unresolvable photos when no waves exist
When no geocodable spatial clusters remain and no waves exist for the user at all, the system SHALL create one or more catch-all waves for unresolvable photos (locationless + geocoding-failed). The catch-all waves SHALL be named `"Uncategorized, <DateRange>"` using the same date-range formatting logic. Unresolvable photos SHALL be split by the same 30-day temporal gap rule before creating catch-all waves.

#### Scenario: Only unresolvable photos, no existing waves
- **WHEN** a user has only unresolvable photos and no waves
- **THEN** the system SHALL create a catch-all wave named `"Uncategorized, <DateRange>"` and assign the photos to it

#### Scenario: Temporal splitting applied to unresolvable photos
- **WHEN** a user has unresolvable photos spanning January 2024 and August 2024 with no existing waves
- **THEN** two catch-all waves SHALL be created (one per temporal cluster, split by the 30-day gap)

#### Scenario: Catch-all wave has no location geometry
- **WHEN** a catch-all wave is created for unresolvable photos
- **THEN** the wave record SHALL have `location` set to NULL and `radius` set to the default value
