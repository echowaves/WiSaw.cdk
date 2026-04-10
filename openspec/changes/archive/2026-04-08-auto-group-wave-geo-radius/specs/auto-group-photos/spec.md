## MODIFIED Requirements

### Requirement: Auto-group creates a wave for each cluster
The system SHALL create **at most one** Wave record per invocation of `autoGroupPhotosIntoWaves(uuid)`. The user MUST have a registered secret (a record in the `Secrets` table). The created wave SHALL have `open = false`, `splashDate` set to the oldest photo's `createdAt` in the cluster, and `freezeDate` set to the newest photo's `createdAt` in the cluster (ensuring the wave is frozen since `freezeDate` is in the past). It SHALL run the full clustering pipeline (spatial DBSCAN + temporal gap splitting), sort the resulting temporal clusters by `earliestDate` ascending, and create a Wave for only the **first** (oldest) cluster. The Wave SHALL be owned by the requesting user (`createdBy = uuid`), SHALL have its location set to the anchor photo's coordinates (first geolocated photo by `createdAt`), and SHALL have the user auto-added to `WaveUsers` with `role = 'owner'`. The wave's `radius` SHALL be computed from the maximum haversine distance between the anchor and any other geolocated photo in the cluster, with a 20% buffer (minimum 10km buffer), and a floor of 5km. The mutation result SHALL include the created wave's `waveUuid` and `name`. When no ungrouped photos exist, `waveUuid` and `name` SHALL be null. After creating the wave, the system SHALL count remaining ungrouped photos and return `hasMore` and `photosRemaining` so the client can call again.

#### Scenario: One wave created per invocation
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked by a user with a registered secret and clustering produces 5 temporal clusters
- **THEN** exactly one Wave SHALL be created for the cluster with the oldest `earliestDate`, with `open = false`, `splashDate` = oldest photo date, `freezeDate` = newest photo date

#### Scenario: User without secret cannot auto-group
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is called by a user with no record in the `Secrets` table
- **THEN** the system SHALL throw an error indicating the user must register an identity first

#### Scenario: Auto-created wave is frozen via dates
- **WHEN** a wave is created by `autoGroupPhotosIntoWaves`
- **THEN** the wave's `splashDate` SHALL be the earliest photo `createdAt` in the cluster and `freezeDate` SHALL be the latest photo `createdAt` in the cluster, making the wave frozen since both dates are in the past

#### Scenario: Auto-created wave is invite-only
- **WHEN** a wave is created by `autoGroupPhotosIntoWaves`
- **THEN** the wave's `open` field SHALL be `false`

#### Scenario: Creator added as owner
- **WHEN** a wave is created by `autoGroupPhotosIntoWaves`
- **THEN** the creator's `WaveUsers` record SHALL have `role = 'owner'`

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

#### Scenario: Radius computed from cluster spread
- **WHEN** a cluster's geolocated photos span up to 80km from the anchor
- **THEN** the wave's `radius` SHALL be `max(80 * 1.2, 80 + 10, 5)` = 96km

#### Scenario: Radius uses minimum buffer for small clusters
- **WHEN** a cluster's geolocated photos are all within 2km of the anchor
- **THEN** the wave's `radius` SHALL be `max(2 * 1.2, 2 + 10, 5)` = 12km

#### Scenario: Radius floor for single-photo cluster
- **WHEN** a cluster has only one geolocated photo (the anchor)
- **THEN** the wave's `radius` SHALL be 5km (the floor)

#### Scenario: Locationless-only cluster has no geo-fence
- **WHEN** a cluster has no geolocated photos (all locationless)
- **THEN** the wave SHALL have `location = NULL` and `radius` SHALL be the default (no geo-fence applies)
