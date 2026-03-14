## MODIFIED Requirements

### Requirement: List Waves for a user
The system SHALL return a paginated list of Waves that a given UUID is a member of, ordered by most recently updated. Each wave SHALL include up to 5 thumbnail URLs of its most recent active photos and a total count of all active photos.

#### Scenario: Waves listed with photo URLs limited to 5
- **WHEN** `listWaves(pageNumber, batch, uuid)` is called
- **THEN** each Wave in the response SHALL include a `photos` field containing at most 5 thumbnail URLs (`https://${S3_IMAGES}/${photoId}-thumb.webp`) for the most recent active photos, ordered by `createdAt` descending

#### Scenario: Waves listed with photosCount
- **WHEN** `listWaves(pageNumber, batch, uuid)` is called
- **THEN** each Wave in the response SHALL include a `photosCount` field with the total number of active photos associated with that wave

#### Scenario: Wave with no photos
- **WHEN** a Wave has no associated photos in `WavePhotos` or all its photos are inactive
- **THEN** the `photos` field SHALL be an empty array and `photosCount` SHALL be 0

#### Scenario: Wave with fewer than 5 photos
- **WHEN** a Wave has fewer than 5 active photos
- **THEN** the `photos` field SHALL contain all available thumbnail URLs and `photosCount` SHALL equal the length of `photos`

#### Scenario: No more data signal
- **WHEN** the number of returned Waves is less than the page size
- **THEN** `noMoreData` is `true`
