## MODIFIED Requirements

### Requirement: Auto-group creates a wave for each cluster
The system SHALL create one Wave record per invocation (the oldest temporal cluster). The Wave SHALL be owned by the requesting user (`createdBy = uuid`), SHALL have its location set to the centroid of the cluster's photos, and SHALL have the user auto-added to `WaveUsers`. The mutation result SHALL include the created wave's `waveUuid` and `name`. When no ungrouped photos exist, `waveUuid` and `name` SHALL be null.

#### Scenario: Wave created for a cluster
- **WHEN** a cluster of 15 photos near Brooklyn, NY is identified
- **THEN** a Wave SHALL be created with `createdBy` set to the user's UUID, `location` set to the centroid via `ST_MakePoint`, and a `WaveUsers` record inserted for the user

#### Scenario: All cluster photos associated with the wave
- **WHEN** a Wave is created for a cluster
- **THEN** a `WavePhotos` record SHALL be inserted for every photo in that cluster

#### Scenario: Result includes wave identity
- **WHEN** `autoGroupPhotosIntoWaves` creates a wave
- **THEN** the result SHALL include `waveUuid` (the UUID of the created wave) and `name` (the generated wave name)

#### Scenario: No wave created returns null identity
- **WHEN** `autoGroupPhotosIntoWaves` is called and the user has no ungrouped photos with locations
- **THEN** the result SHALL have `waveUuid: null` and `name: null`
