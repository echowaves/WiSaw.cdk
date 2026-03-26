## MODIFIED Requirements

### Requirement: List Waves for a user
The system SHALL return a paginated list of Waves that a given UUID is a member of, ordered by most recently updated. Each wave SHALL include up to 5 full `Photo` objects of its most recent active photos (with computed `imgUrl`, `thumbUrl`, `videoUrl` fields) and `photosCount` read directly from the persisted column.

#### Scenario: Waves listed with Photo objects limited to 5
- **WHEN** `listWaves(pageNumber, batch, uuid)` is called
- **THEN** each Wave in the response SHALL include a `photos` field containing at most 5 `Photo` objects for the most recent active photos, ordered by `createdAt` descending. Each Photo SHALL include `id`, `uuid`, `location`, `commentsCount`, `watchersCount`, `createdAt`, `updatedAt`, `active`, `video`, `width`, `height`, `lastComment`, `imgUrl`, `thumbUrl`, `videoUrl`, and `row_number`.

#### Scenario: Photo objects include computed URL fields
- **WHEN** Photo objects are returned in the `photos` array
- **THEN** each Photo SHALL have `imgUrl` set to `https://${S3_IMAGES}/${id}.webp`, `thumbUrl` set to `https://${S3_IMAGES}/${id}-thumb.webp`, and `videoUrl` set to `https://${S3_IMAGES}/${id}.mov`

#### Scenario: Photo row_number is the position within the wave
- **WHEN** Photo objects are returned in the `photos` array
- **THEN** each Photo's `row_number` SHALL be its 1-based position within that wave's photo list (1 through 5)

#### Scenario: Waves listed with photosCount from column
- **WHEN** `listWaves(pageNumber, batch, uuid)` is called
- **THEN** each Wave in the response SHALL include `photosCount` from the `Waves` table column (not computed at query time)

#### Scenario: Wave with no photos
- **WHEN** a Wave has no associated photos in `WavePhotos` or all its photos are inactive
- **THEN** the `photos` field SHALL be an empty array and `photosCount` SHALL be 0

#### Scenario: Wave with fewer than 5 photos
- **WHEN** a Wave has fewer than 5 active photos
- **THEN** the `photos` field SHALL contain all available Photo objects and `photosCount` SHALL equal the length of `photos`

#### Scenario: No more data signal
- **WHEN** the number of returned Waves is less than the page size
- **THEN** `noMoreData` is `true`
