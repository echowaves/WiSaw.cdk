## ADDED Requirements

### Requirement: Merge two waves into one
The system SHALL provide a `mergeWaves` GraphQL mutation that merges a source wave into a target wave. The mutation SHALL accept `targetWaveUuid`, `sourceWaveUuid`, `uuid` (requesting user), and optional `name` and `description` fields. It SHALL return the updated target `Wave`.

#### Scenario: Successful merge of two waves
- **WHEN** user calls `mergeWaves` with valid targetWaveUuid, sourceWaveUuid, and uuid where the user is the creator of both waves
- **THEN** all photos from the source wave are moved to the target wave, WaveUsers from the source are added to the target (without duplicates), the source wave is deleted, the target's photosCount is recalculated, and the merged target Wave is returned

#### Scenario: Merge with optional rename
- **WHEN** user calls `mergeWaves` with a `name` argument provided
- **THEN** the target wave's name is updated to the provided value before returning

#### Scenario: Merge with optional description update
- **WHEN** user calls `mergeWaves` with a `description` argument provided
- **THEN** the target wave's description is updated to the provided value before returning

### Requirement: Preserve photo ownership on merge
The system SHALL preserve the original `createdBy` value on each WavePhotos row when moving photos from the source wave to the target wave.

#### Scenario: Photos retain original createdBy after merge
- **WHEN** photos are moved from source to target during a merge
- **THEN** each WavePhotos row keeps its original `createdBy` value unchanged

### Requirement: Merge WaveUsers without duplicates
The system SHALL merge WaveUsers from the source wave into the target wave. If a user already exists in the target wave's WaveUsers, no duplicate row SHALL be created.

#### Scenario: Source wave user added to target
- **WHEN** the source wave has a WaveUser who is not in the target wave's WaveUsers
- **THEN** that user is added to the target wave's WaveUsers

#### Scenario: Duplicate WaveUser skipped
- **WHEN** the source wave has a WaveUser who already exists in the target wave's WaveUsers
- **THEN** no duplicate row is created and no error is thrown

### Requirement: Target wave metadata preserved
The system SHALL preserve the target wave's `location`, `radius`, `createdBy`, and `createdAt` fields. Only `name`, `description`, and `updatedAt` MAY change.

#### Scenario: Target location unchanged after merge
- **WHEN** a merge completes
- **THEN** the target wave's location and radius remain unchanged from their pre-merge values

### Requirement: Source wave deleted after merge
The system SHALL delete the source wave after all photos and users have been merged into the target.

#### Scenario: Source wave no longer exists
- **WHEN** a merge completes successfully
- **THEN** the source wave is deleted from the Waves table along with its WavePhotos and WaveUsers entries

### Requirement: Authorization requires ownership of both waves
The system SHALL verify that the requesting user (`uuid`) is the `createdBy` of both the target and source waves before performing the merge.

#### Scenario: User owns both waves
- **WHEN** user is the `createdBy` of both target and source waves
- **THEN** the merge proceeds

#### Scenario: User does not own the target wave
- **WHEN** user is not the `createdBy` of the target wave
- **THEN** the system throws an error and no changes are made

#### Scenario: User does not own the source wave
- **WHEN** user is not the `createdBy` of the source wave
- **THEN** the system throws an error and no changes are made

### Requirement: Input validation
The system SHALL validate all inputs before performing the merge.

#### Scenario: Source and target are the same wave
- **WHEN** `targetWaveUuid` equals `sourceWaveUuid`
- **THEN** the system throws an error "Cannot merge a wave into itself"

#### Scenario: Invalid UUID format
- **WHEN** any of `targetWaveUuid`, `sourceWaveUuid`, or `uuid` is not a valid UUID
- **THEN** the system throws an error indicating wrong UUID format

#### Scenario: Target wave does not exist
- **WHEN** `targetWaveUuid` does not match any wave owned by the user
- **THEN** the system throws an error and no changes are made

#### Scenario: Source wave does not exist
- **WHEN** `sourceWaveUuid` does not match any wave owned by the user
- **THEN** the system throws an error and no changes are made

### Requirement: PhotosCount recalculated after merge
The system SHALL recalculate the target wave's `photosCount` after merging to reflect the total number of active photos.

#### Scenario: PhotosCount reflects merged total
- **WHEN** target had 3 active photos and source had 5 active photos
- **THEN** the target's photosCount is updated to 8 after merge

---

### Requirement: _updatePhotosCount does not manage connection lifecycle
The `_updatePhotosCount` helper SHALL NOT call `psql.connect()` or `psql.clean()`. It SHALL only execute its UPDATE query and return the result, relying on the caller to manage the connection lifecycle.

#### Scenario: Called within mergeWaves
- **WHEN** `mergeWaves` calls `_updatePhotosCount` mid-operation
- **THEN** the connection SHALL remain alive for subsequent queries after `_updatePhotosCount` returns

#### Scenario: Called within addPhotoToWave
- **WHEN** `addPhotoToWave` calls `_updatePhotosCount` after inserting or removing a WavePhotos row
- **THEN** the connection SHALL remain alive for any subsequent operations

#### Scenario: Called within processDeletedImage
- **WHEN** `processDeletedImage` calls `_updatePhotosCount` within its cleanup block
- **THEN** the function SHALL execute successfully using the caller's existing connection
