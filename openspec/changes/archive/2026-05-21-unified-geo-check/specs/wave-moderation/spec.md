## MODIFIED Requirements

### Requirement: Geo-boundary enforcement on photo add
When a wave has `location` and `radius` set, `addPhotoToWave` SHALL verify that the photo's location is within the wave's geo-boundary using the shared `_isLocationInRadius` utility. Photos without GPS data SHALL be rejected from geo-bounded waves. The `_assertGeoBounds` function SHALL delegate to `_isLocationInRadius(photoLat, photoLon, waveUuid)` instead of inlining its own `ST_DWithin` query.

#### Scenario: Photo within boundary accepted
- **WHEN** `addPhotoToWave` is called with a photo whose location is within `radius` km of the wave's location
- **THEN** the photo SHALL be added to the wave normally

#### Scenario: Photo outside boundary rejected
- **WHEN** `addPhotoToWave` is called with a photo whose location is more than `radius` km from the wave's location
- **THEN** the system SHALL throw an error indicating the photo is outside the wave's geo-boundaries

#### Scenario: Photo without GPS rejected from geo-bounded wave
- **WHEN** `addPhotoToWave` is called with a photo that has no location data on a wave with `location` and `radius` set
- **THEN** the system SHALL throw an error indicating the photo must have location data for this wave

#### Scenario: Wave without location skips geo-check
- **WHEN** `addPhotoToWave` is called on a wave with `location = NULL`
- **THEN** the geo-boundary check SHALL be skipped entirely
