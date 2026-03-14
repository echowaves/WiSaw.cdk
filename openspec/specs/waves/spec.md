## ADDED Requirements

### Requirement: Create a Wave
The system SHALL allow a device UUID to create a named content channel (Wave) with an optional description, geo-location, and radius.

#### Scenario: Wave created without location
- **WHEN** `createWave(name, description, uuid)` is called without `lat`, `lon`, or `radius`
- **THEN** a Wave record is inserted with no location geometry stored, the creator is added to `WaveUsers`, and the new Wave is returned

#### Scenario: Wave created with location and radius
- **WHEN** `createWave` is called with `lat`, `lon`, and an optional `radius`
- **THEN** the Wave record stores the location as a PostGIS point via `ST_MakePoint(lon, lat)` and the radius in kilometres (default 50 if omitted)

#### Scenario: Empty name rejected
- **WHEN** `createWave` is called with a blank or whitespace-only `name`
- **THEN** the system throws an error and no Wave is created

#### Scenario: Creator auto-joined to Wave
- **WHEN** a Wave is created
- **THEN** a `WaveUsers` record is inserted for the creating UUID

---

### Requirement: Update a Wave
The system SHALL allow the Wave creator to update its name, description, location, and radius.

#### Scenario: Wave updated
- **WHEN** `updateWave(waveUuid, uuid, name, description, lat, lon, radius)` is called by the creator
- **THEN** the Wave record is updated with the new values and the updated Wave is returned

---

### Requirement: Delete a Wave
The system SHALL allow the Wave creator to delete a Wave.

#### Scenario: Wave deleted
- **WHEN** `deleteWave(waveUuid, uuid)` is called by the creator
- **THEN** the Wave record is removed and `true` is returned

---

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

---

### Requirement: Add a photo to a Wave
The system SHALL allow a Wave member to associate an existing photo with a Wave.

#### Scenario: Photo added to Wave
- **WHEN** `addPhotoToWave(waveUuid, photoId, uuid)` is called
- **THEN** a `WavePhotos` record is created linking the photo to the Wave and `true` is returned

---

### Requirement: Remove a photo from a Wave
The system SHALL allow removal of a photo from a Wave.

#### Scenario: Photo removed from Wave
- **WHEN** `removePhotoFromWave(waveUuid, photoId)` is called
- **THEN** the `WavePhotos` record is deleted and `true` is returned

---

### Requirement: Wave-filtered feeds
The system SHALL accept an optional `waveUuid` on all feed queries to restrict results to photos that belong to the specified Wave.

#### Scenario: Feed scoped to a Wave
- **WHEN** any feed query is called with a non-null `waveUuid`
- **THEN** only photos that have a matching `WavePhotos` record for that Wave are returned

---

### Requirement: Auto-group photos into waves mutation
The system SHALL expose an `autoGroupPhotosIntoWaves(uuid)` GraphQL mutation that triggers automatic grouping of a user's ungrouped photos into waves.

#### Scenario: Mutation invoked
- **WHEN** `autoGroupPhotosIntoWaves(uuid: String!)` is called via GraphQL
- **THEN** the system SHALL execute the auto-grouping logic for the specified user and return an `AutoGroupResult` containing `wavesCreated` and `photosGrouped`

#### Scenario: AutoGroupResult type
- **WHEN** the mutation completes
- **THEN** the result SHALL conform to the GraphQL type `AutoGroupResult { wavesCreated: Int!, photosGrouped: Int! }`
