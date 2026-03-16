### Requirement: removePhotoFromWave returns Boolean
The `removePhotoFromWave` GraphQL mutation SHALL return `true` (Boolean) upon successful removal of a photo from a wave, matching the `Boolean!` return type declared in the GraphQL schema.

#### Scenario: Successful photo removal
- **WHEN** a client calls `removePhotoFromWave` with valid `waveUuid` and `photoId`
- **THEN** the mutation deletes the `WavePhotos` row, updates the photos count, and returns `true`

#### Scenario: Invalid UUID format
- **WHEN** a client calls `removePhotoFromWave` with an invalid UUID for `waveUuid` or `photoId`
- **THEN** the mutation SHALL throw an error with message indicating wrong UUID format
