## ADDED Requirements

### Requirement: PhotoDetails includes wave information
The system SHALL return wave association data as part of the `PhotoDetails` GraphQL type. The fields `waveName` and `waveUuid` SHALL be nullable strings.

#### Scenario: Photo belongs to a wave
- **WHEN** `getPhotoDetails(photoId, uuid)` is called for a photo that is in a wave
- **THEN** the response SHALL include `waveName` with the wave's name and `waveUuid` with the wave's UUID

#### Scenario: Photo does not belong to any wave
- **WHEN** `getPhotoDetails(photoId, uuid)` is called for a photo that has no `WavePhotos` record
- **THEN** the response SHALL include `waveName: null` and `waveUuid: null`
