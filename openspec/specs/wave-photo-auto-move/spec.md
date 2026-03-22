## ADDED Requirements

### Requirement: addPhotoToWave auto-removes photo from previous wave
The `addPhotoToWave` controller SHALL automatically remove a photo from its current wave before adding it to the target wave. If the photo is not in any wave, it SHALL be added directly. The `photosCount` on both the old and new waves SHALL be updated.

#### Scenario: Photo not in any wave — added normally
- **WHEN** `addPhotoToWave` is called with a photoId that is not in any wave
- **THEN** the photo is inserted into the target wave's `WavePhotos` and the target wave's `photosCount` is incremented

#### Scenario: Photo already in the same wave — no-op
- **WHEN** `addPhotoToWave` is called with a photoId that is already in the target wave
- **THEN** no duplicate row is created (ON CONFLICT DO NOTHING) and no error is thrown

#### Scenario: Photo in a different wave — auto-moved
- **WHEN** `addPhotoToWave` is called with a photoId that belongs to a different wave
- **THEN** the photo is removed from the old wave, the old wave's `photosCount` is decremented, the photo is added to the target wave, and the target wave's `photosCount` is incremented

#### Scenario: No "Photo is already in a wave" error
- **WHEN** `addPhotoToWave` is called with a photoId that belongs to a different wave
- **THEN** the operation succeeds without throwing an error
