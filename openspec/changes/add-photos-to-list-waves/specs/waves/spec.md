## MODIFIED Requirements

### Requirement: List Waves for a user
The system SHALL return a paginated list of Waves that a given UUID is a member of, ordered by most recently updated. Each wave SHALL include the thumbnail URLs of its associated active photos.

#### Scenario: Waves listed with photo URLs
- **WHEN** `listWaves(pageNumber, batch, uuid)` is called
- **THEN** each Wave in the response SHALL include a `photos` field containing thumbnail URLs (`https://${S3_IMAGES}/${photoId}-thumb.webp`) for all active photos associated with that wave, ordered by photo `createdAt` descending

#### Scenario: Wave with no photos
- **WHEN** a Wave has no associated photos in `WavePhotos` or all its photos are inactive
- **THEN** the `photos` field SHALL be an empty array

#### Scenario: No more data signal
- **WHEN** the number of returned Waves is less than the page size
- **THEN** `noMoreData` is `true`
