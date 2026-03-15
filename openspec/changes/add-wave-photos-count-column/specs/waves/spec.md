## MODIFIED Requirements

### Requirement: Add a photo to a Wave
The system SHALL allow a Wave member to associate an existing photo with a Wave. After the association is created, the system SHALL update the wave's `photosCount` to reflect the current number of active photos.

#### Scenario: Photo added to Wave
- **WHEN** `addPhotoToWave(waveUuid, photoId, uuid)` is called
- **THEN** a `WavePhotos` record is created linking the photo to the Wave, the wave's `photosCount` is recalculated, and `true` is returned

#### Scenario: Duplicate photo add is idempotent
- **WHEN** `addPhotoToWave` is called for a photo already in the wave
- **THEN** the insert is ignored (ON CONFLICT DO NOTHING), `photosCount` is recalculated, and `true` is returned

### Requirement: Remove a photo from a Wave
The system SHALL allow removal of a photo from a Wave. After the removal, the system SHALL update the wave's `photosCount`.

#### Scenario: Photo removed from Wave
- **WHEN** `removePhotoFromWave(waveUuid, photoId)` is called
- **THEN** the `WavePhotos` record is deleted, the wave's `photosCount` is recalculated, and `true` is returned

### Requirement: Auto-group photos into Waves
The system SHALL auto-group ungrouped photos into waves. After each wave is populated, the system SHALL update its `photosCount`.

#### Scenario: Photos auto-grouped
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` creates or populates a wave
- **THEN** the wave's `photosCount` is recalculated after all photos are assigned to it

### Requirement: Photo deletion cleans up wave associations
The system SHALL remove `WavePhotos` records when a photo is deleted. After cleanup, the system SHALL update `photosCount` for all affected waves.

#### Scenario: Deleted photo removed from waves
- **WHEN** a photo is deleted and its `WavePhotos` records are removed
- **THEN** `photosCount` is recalculated for each wave that contained the photo

### Requirement: List Waves for a user
The system SHALL return a paginated list of Waves that a given UUID is a member of, ordered by most recently updated. Each wave SHALL include `photosCount` read directly from the persisted column.

#### Scenario: Waves listed with photosCount from column
- **WHEN** `listWaves(pageNumber, batch, uuid)` is called
- **THEN** each Wave in the response SHALL include `photosCount` from the `Waves` table column (not computed at query time)

#### Scenario: No more data signal
- **WHEN** the number of returned Waves is less than the page size
- **THEN** `noMoreData` is `true`
