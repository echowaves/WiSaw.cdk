## MODIFIED Requirements

### Requirement: Add a photo to a Wave
The system SHALL allow a Wave member to associate an existing photo with a Wave, provided the photo is not already in any wave. After the association is created, the system SHALL update the wave's `photosCount` to reflect the current number of active photos.

#### Scenario: Photo added to Wave
- **WHEN** `addPhotoToWave(waveUuid, photoId, uuid)` is called and the photo is not in any wave
- **THEN** a `WavePhotos` record is created linking the photo to the Wave, the wave's `photosCount` is recalculated, and `true` is returned

#### Scenario: Duplicate photo add is idempotent
- **WHEN** `addPhotoToWave` is called for a photo already in the same wave
- **THEN** the insert is ignored (ON CONFLICT DO NOTHING), `photosCount` is recalculated, and `true` is returned

#### Scenario: Photo already in another wave is rejected
- **WHEN** `addPhotoToWave` is called for a photo that is already in a different wave
- **THEN** the system SHALL throw an error indicating the photo is already in a wave
