## MODIFIED Requirements

### Requirement: removePhotoFromWave returns Boolean
The `removePhotoFromWave` GraphQL mutation SHALL return `true` (Boolean) upon successful removal of a photo from a wave, matching the `Boolean!` return type declared in the GraphQL schema. Removal is subject to role-based permissions: owner can always remove (even from frozen waves), facilitator can remove from unfrozen waves, contributor can remove their own photo from unfrozen waves.

#### Scenario: Successful photo removal by owner
- **WHEN** a client calls `removePhotoFromWave` with valid `waveUuid` and `photoId` as the wave owner
- **THEN** the mutation deletes the `WavePhotos` row, updates the photos count, and returns `true`

#### Scenario: Successful photo removal by owner on frozen wave
- **WHEN** a client calls `removePhotoFromWave` as the wave owner on a frozen wave
- **THEN** the mutation deletes the `WavePhotos` row, updates the photos count, and returns `true` (owner overrides freeze)

#### Scenario: Successful photo removal by facilitator on unfrozen wave
- **WHEN** a client calls `removePhotoFromWave` as a facilitator on an unfrozen wave
- **THEN** the mutation deletes the `WavePhotos` row, updates the photos count, and returns `true`

#### Scenario: Facilitator blocked on frozen wave
- **WHEN** a client calls `removePhotoFromWave` as a facilitator on a frozen wave
- **THEN** the mutation SHALL throw an error indicating the wave is frozen

#### Scenario: Contributor removes own photo from unfrozen wave
- **WHEN** a client calls `removePhotoFromWave` as a contributor for a photo where `WavePhotos.createdBy` matches their UUID on an unfrozen wave
- **THEN** the mutation deletes the `WavePhotos` row, updates the photos count, and returns `true`

#### Scenario: Contributor cannot remove others' photos
- **WHEN** a client calls `removePhotoFromWave` as a contributor for a photo not created by them
- **THEN** the mutation SHALL throw an error indicating insufficient permissions

#### Scenario: Contributor blocked on frozen wave
- **WHEN** a client calls `removePhotoFromWave` as a contributor on a frozen wave
- **THEN** the mutation SHALL throw an error indicating the wave is frozen

#### Scenario: Invalid UUID format
- **WHEN** a client calls `removePhotoFromWave` with an invalid UUID for `waveUuid` or `photoId`
- **THEN** the mutation SHALL throw an error with message indicating wrong UUID format
