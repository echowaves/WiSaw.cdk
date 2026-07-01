## ADDED Requirements

### Requirement: Merge multiple waves into one
The system SHALL provide a `mergeWaves` GraphQL mutation that merges one or more source waves into a single target wave. The mutation SHALL accept `targetWaveUuid`, `sourceWaveUuids` (non-empty array of UUIDs), `uuid` (requesting user), and optional `name` and `description` fields. It SHALL return the updated target `Wave`. **Owners of all waves may merge regardless of freeze state.**

#### Scenario: Successful merge of two waves
- **WHEN** user calls `mergeWaves` with `sourceWaveUuids` containing one UUID, a valid `targetWaveUuid`, and `uuid` where the user is the owner of both waves
- **THEN** all photos from the source wave are moved to the target wave, WaveUsers from the source are added to the target (without duplicates, preserving roles), the source wave is deleted, the target's photosCount is recalculated, and the merged target Wave is returned

#### Scenario: Successful merge of three or more waves
- **WHEN** user calls `mergeWaves` with `sourceWaveUuids` containing three or more valid UUIDs and the user is the owner of the target wave and all source waves
- **THEN** all photos from all source waves are moved to the target wave, all WaveUsers from all source waves are added to the target (without duplicates), all source waves are deleted, the target's photosCount reflects the combined total of all merged waves, and the merged target Wave is returned

#### Scenario: Merge preserves target wave name
- **WHEN** a merge completes without a `name` argument
- **THEN** the target wave's name is preserved unchanged from its pre-merge value

#### Scenario: Merge with optional name override
- **WHEN** user calls `mergeWaves` with a `name` argument provided
- **THEN** the target wave's name is updated to the provided value after all sources are merged

#### Scenario: Owner merges frozen waves
- **WHEN** user calls `mergeWaves` where both the target and source waves are owned by the caller AND one or both waves are frozen (via `freezeMode = 'FROZEN'`, `freezeMode = 'AUTO'`, or date-based freeze)
- **THEN** the merge proceeds normally without any freeze restriction

### Requirement: Merge blocked if user does not own all waves
The system SHALL reject a merge when the requesting user is not the owner of the target wave or any of the source waves.

#### Scenario: Non-owner cannot initiate merge
- **WHEN** `mergeWaves` is called by a user who does not own at least one of the specified waves (target or any source)
- **THEN** the system SHALL throw an authorization error and no changes are made

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
The system SHALL verify that the requesting user (`uuid`) has `role = 'owner'` in `WaveUsers` for both the target and source waves before performing the merge.

#### Scenario: User owns all waves
- **WHEN** user has `role = 'owner'` in `WaveUsers` for the target wave and all source waves in `sourceWaveUuids`
- **THEN** the merge proceeds

#### Scenario: User does not own the target wave
- **WHEN** user does not have `role = 'owner'` in `WaveUsers` for the target wave
- **THEN** the system throws an error and no changes are made

#### Scenario: User does not own the source wave
- **WHEN** user does not have `role = 'owner'` in `WaveUsers` for any source wave in `sourceWaveUuids`
- **THEN** the system throws an error and no changes are made

### Requirement: Input validation
The system SHALL validate all inputs before performing the merge.

#### Scenario: Source and target are the same wave
- **WHEN** `sourceWaveUuids` contains a UUID that equals `targetWaveUuid`
- **THEN** the system throws an error "Cannot merge a wave into itself"

#### Scenario: Invalid UUID format
- **WHEN** any of `targetWaveUuid`, `uuid`, or any element in `sourceWaveUuids` is not a valid UUID
- **THEN** the system throws an error indicating wrong UUID format

#### Scenario: Target wave does not exist
- **WHEN** `targetWaveUuid` does not match any wave owned by the user
- **THEN** the system throws an error and no changes are made

#### Scenario: Source wave does not exist
- **WHEN** an element in `sourceWaveUuids` does not match any wave owned by the user
- **THEN** the system throws an error and no changes are made

#### Scenario: Empty source wave list
- **WHEN** `sourceWaveUuids` is an empty array
- **THEN** the system throws an error "At least one source wave must be provided"

#### Scenario: Duplicate source wave UUIDs
- **WHEN** `sourceWaveUuids` contains the same UUID more than once
- **THEN** the system throws an error "Duplicate source wave UUID"

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
