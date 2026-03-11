## MODIFIED Requirements

### Requirement: Auto-group creates a wave for each cluster
The system SHALL create **at most one** Wave record per invocation of `autoGroupPhotosIntoWaves(uuid)`. It SHALL run the full clustering pipeline (spatial DBSCAN + temporal gap splitting), sort the resulting temporal clusters by `earliestDate` ascending, and create a Wave for only the **first** (oldest) cluster. The Wave SHALL be owned by the requesting user (`createdBy = uuid`), SHALL have its location set to the centroid of the cluster's photos, and SHALL have the user auto-added to `WaveUsers`. After creating the wave, the system SHALL count remaining ungrouped photos and return `hasMore` and `photosRemaining` so the client can call again.

#### Scenario: One wave created per invocation
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked and clustering produces 5 temporal clusters
- **THEN** exactly one Wave SHALL be created for the cluster with the oldest `earliestDate`

#### Scenario: Wave created for oldest cluster
- **WHEN** clusters exist from 2023, 2024, and 2025
- **THEN** the 2023 cluster SHALL be processed first

#### Scenario: All cluster photos associated with the wave
- **WHEN** a Wave is created for a cluster
- **THEN** a `WavePhotos` record SHALL be inserted for every photo in that cluster

#### Scenario: Result indicates more photos remain
- **WHEN** a wave is created and ungrouped photos still exist
- **THEN** the result SHALL have `hasMore: true` and `photosRemaining` set to the count of remaining ungrouped photos

#### Scenario: Result indicates completion
- **WHEN** a wave is created and no ungrouped photos remain afterward
- **THEN** the result SHALL have `hasMore: false` and `photosRemaining: 0`

#### Scenario: No ungrouped photos exist
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked and no ungrouped photos exist
- **THEN** the result SHALL have `wavesCreated: 0`, `photosGrouped: 0`, `hasMore: false`, and `photosRemaining: 0`

#### Scenario: Idempotent re-invocation
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked a second time after all photos have been grouped with no new photos
- **THEN** no new waves SHALL be created and the result SHALL indicate zero waves created with `hasMore: false`

## ADDED Requirements

### Requirement: AutoGroupResult includes continuation fields
The `AutoGroupResult` GraphQL type SHALL include `photosRemaining: Int!` (count of ungrouped photos after this invocation) and `hasMore: Boolean!` (whether the client should call again). The existing `wavesCreated` and `photosGrouped` fields SHALL be retained and reflect only the current invocation (0 or 1 wave, 0 or N photos).

#### Scenario: GraphQL type shape
- **WHEN** the client queries `autoGroupPhotosIntoWaves`
- **THEN** the response SHALL include `wavesCreated`, `photosGrouped`, `photosRemaining`, and `hasMore`

#### Scenario: Client loops until done
- **WHEN** the client calls `autoGroupPhotosIntoWaves` and receives `hasMore: true`
- **THEN** the client SHALL call again to process the next cluster
