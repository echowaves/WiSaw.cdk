## ADDED Requirements

### Requirement: Create a Wave
The system SHALL allow a device (identified by its `uuid`) to create a named content channel (Wave) with an optional description, geo-location, and radius. The user MUST have a registered secret (a record in the `Secrets` table) to create a wave. The wave SHALL be created with `open = false` and `frozen = false` by default.

#### Scenario: Wave created without location
- **WHEN** `createWave(name, description, uuid)` is called without `lat`, `lon`, or `radius` by a user with a registered secret
- **THEN** a Wave record is inserted with no location geometry stored, `open = false`, `frozen = false`, the creator is added to `WaveUsers` with `role = 'owner'`, and the new Wave is returned

#### Scenario: Wave created with location and radius
- **WHEN** `createWave` is called with `lat`, `lon`, and an optional `radius` by a user with a registered secret
- **THEN** the Wave record stores the location as a PostGIS point via `ST_MakePoint(lon, lat)` and the radius in kilometres (default 50 if omitted)

#### Scenario: Empty name rejected
- **WHEN** `createWave` is called with a blank or whitespace-only `name`
- **THEN** the system throws an error and no Wave is created

#### Scenario: Creator auto-joined to Wave
- **WHEN** a Wave is created
- **THEN** a `WaveUsers` record is inserted for the creating UUID with `role = 'owner'`

#### Scenario: User without secret cannot create wave
- **WHEN** `createWave` is called by a user with no record in the `Secrets` table
- **THEN** the system SHALL throw an error indicating the user must register an identity first

---

### Requirement: Update a Wave
The system SHALL allow the Wave owner to update its name, description, location, radius, open status, frozen status, startDate, and endDate. Only users with `role = 'owner'` in `WaveUsers` SHALL be able to update. When the wave is frozen, only `frozen` and `endDate` field changes SHALL be allowed.

#### Scenario: Wave updated by owner
- **WHEN** `updateWave(waveUuid, uuid, name, description, lat, lon, radius)` is called by the owner on an unfrozen wave
- **THEN** the Wave record is updated with the new values and the updated Wave is returned

#### Scenario: Non-owner cannot update
- **WHEN** `updateWave` is called by a facilitator or contributor
- **THEN** the system SHALL throw an error indicating insufficient permissions

#### Scenario: Frozen wave — only freeze fields allowed
- **WHEN** `updateWave` is called on a frozen wave with changes to `name`, `description`, `location`, `radius`, `open`, or `startDate`
- **THEN** the system SHALL throw an error indicating the wave is frozen

#### Scenario: Frozen wave — unfreeze allowed
- **WHEN** `updateWave(waveUuid, uuid, frozen: false, endDate: null)` is called by the owner on a frozen wave
- **THEN** the wave SHALL be unfrozen

#### Scenario: Owner toggles wave to open
- **WHEN** `updateWave(waveUuid, uuid, open: true)` is called by the owner
- **THEN** `Waves.open` SHALL be set to `true`

#### Scenario: Owner sets start and end dates
- **WHEN** `updateWave(waveUuid, uuid, startDate: <future>, endDate: <later>)` is called by the owner
- **THEN** `Waves.startDate` and `Waves.endDate` SHALL be updated

---

### Requirement: Delete a Wave
The system SHALL allow the Wave owner to delete a Wave, even if the wave is frozen. Only users with `role = 'owner'` in `WaveUsers` SHALL be able to delete.

#### Scenario: Wave deleted by owner
- **WHEN** `deleteWave(waveUuid, uuid)` is called by the owner
- **THEN** the Wave record is removed and `true` is returned

#### Scenario: Frozen wave deleted by owner
- **WHEN** `deleteWave(waveUuid, uuid)` is called by the owner on a frozen wave
- **THEN** the Wave SHALL still be deleted (owner privilege overrides freeze)

#### Scenario: Non-owner cannot delete
- **WHEN** `deleteWave` is called by a facilitator or contributor
- **THEN** the system SHALL throw an error indicating insufficient permissions

---

### Requirement: List Waves for a user
The system SHALL return a paginated list of Waves that a given UUID is a member of, ordered by most recently updated. Each wave SHALL include up to 5 full `Photo` objects of its most recent active photos (with computed `imgUrl`, `thumbUrl`, `videoUrl` fields) and `photosCount` read directly from the persisted column.

#### Scenario: Waves listed with Photo objects limited to 5
- **WHEN** `listWaves(pageNumber, batch, uuid)` is called
- **THEN** each Wave in the response SHALL include a `photos` field containing at most 5 `Photo` objects for the most recent active photos, ordered by `updatedAt` descending (matching `feedForWave` ordering). Each Photo SHALL include `id`, `uuid`, `location`, `commentsCount`, `watchersCount`, `createdAt`, `updatedAt`, `active`, `video`, `width`, `height`, `lastComment`, `imgUrl`, `thumbUrl`, `videoUrl`, and `row_number`.

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

---

### Requirement: Add a photo to a Wave
The system SHALL allow a Wave member to associate an existing photo with a Wave, subject to: the user must be a member and not banned, the wave must not be frozen, the wave must be past its startDate (if set), and the photo must be within geo-boundaries (if set). After the association is created, the system SHALL update the wave's `photosCount`. If the photo is currently in another wave, the system SHALL check if that source wave is frozen — if frozen, the move SHALL be blocked (unless the caller is the owner of the source wave).

#### Scenario: Photo added to Wave
- **WHEN** `addPhotoToWave(waveUuid, photoId, uuid)` is called by a member on an active, unfrozen wave and the photo is not in any wave
- **THEN** a `WavePhotos` record is created linking the photo to the Wave, the wave's `photosCount` is recalculated, and `true` is returned

#### Scenario: Duplicate photo add is idempotent
- **WHEN** `addPhotoToWave` is called for a photo already in the same wave
- **THEN** the insert is ignored (ON CONFLICT DO NOTHING), `photosCount` is recalculated, and `true` is returned

#### Scenario: Photo already in another wave is rejected
- **WHEN** `addPhotoToWave` is called for a photo that is already in a different wave
- **THEN** the system SHALL throw an error indicating the photo is already in a wave

#### Scenario: Non-member cannot add photo
- **WHEN** `addPhotoToWave` is called by a user who is not in `WaveUsers` for the wave
- **THEN** the system SHALL throw an error indicating the user is not a member

#### Scenario: Banned user cannot add photo
- **WHEN** `addPhotoToWave` is called by a user with a `WaveBans` record for the wave
- **THEN** the system SHALL throw an error indicating the user is banned

#### Scenario: Photo rejected on frozen wave
- **WHEN** `addPhotoToWave` is called on a frozen wave
- **THEN** the system SHALL throw an error indicating the wave is frozen

#### Scenario: Photo rejected before startDate
- **WHEN** `addPhotoToWave` is called on a wave whose `startDate` is in the future
- **THEN** the system SHALL throw an error indicating the wave is not yet accepting contributions

#### Scenario: Photo outside geo-boundary rejected
- **WHEN** `addPhotoToWave` is called with a photo outside the wave's radius
- **THEN** the system SHALL throw an error indicating the photo is outside the wave's geo-boundaries

#### Scenario: Photo without GPS rejected from geo-bounded wave
- **WHEN** `addPhotoToWave` is called with a locationless photo on a wave with geo-boundaries
- **THEN** the system SHALL throw an error indicating the photo must have location data

---

### Requirement: Remove a photo from a Wave
The system SHALL allow removal of a photo from a Wave with role-based permissions. Owner can always remove (even from frozen waves). Facilitator can remove any photo from unfrozen waves. Contributor can remove their own photo from unfrozen waves. After the removal, the system SHALL update the wave's `photosCount`.

#### Scenario: Owner removes photo from unfrozen wave
- **WHEN** `removePhotoFromWave(waveUuid, photoId, uuid)` is called by the owner on an unfrozen wave
- **THEN** the `WavePhotos` record is deleted, `photosCount` is recalculated, and `true` is returned

#### Scenario: Owner removes photo from frozen wave
- **WHEN** `removePhotoFromWave(waveUuid, photoId, uuid)` is called by the owner on a frozen wave
- **THEN** the `WavePhotos` record is deleted, `photosCount` is recalculated, and `true` is returned (owner overrides freeze)

#### Scenario: Facilitator removes photo from unfrozen wave
- **WHEN** `removePhotoFromWave` is called by a facilitator on an unfrozen wave
- **THEN** the `WavePhotos` record is deleted, `photosCount` is recalculated, and `true` is returned

#### Scenario: Facilitator blocked on frozen wave
- **WHEN** `removePhotoFromWave` is called by a facilitator on a frozen wave
- **THEN** the system SHALL throw an error indicating the wave is frozen

#### Scenario: Contributor removes own photo from unfrozen wave
- **WHEN** `removePhotoFromWave` is called by a contributor for a photo where `WavePhotos.createdBy` matches the caller's UUID on an unfrozen wave
- **THEN** the `WavePhotos` record is deleted, `photosCount` is recalculated, and `true` is returned

#### Scenario: Contributor cannot remove others' photos
- **WHEN** `removePhotoFromWave` is called by a contributor for a photo not created by them
- **THEN** the system SHALL throw an error indicating insufficient permissions

#### Scenario: Contributor blocked on frozen wave
- **WHEN** `removePhotoFromWave` is called by a contributor on a frozen wave
- **THEN** the system SHALL throw an error indicating the wave is frozen

---

### Requirement: Wave-filtered feeds
The system SHALL accept an optional `waveUuid` on all feed queries to restrict results to photos that belong to the specified Wave.

#### Scenario: Feed scoped to a Wave
- **WHEN** any feed query is called with a non-null `waveUuid`
- **THEN** only photos that have a matching `WavePhotos` record for that Wave are returned

---

### Requirement: Auto-group photos into waves mutation
The system SHALL expose an `autoGroupPhotosIntoWaves(uuid)` GraphQL mutation that triggers automatic grouping of a user's ungrouped photos into waves. After each wave is populated, the system SHALL update its `photosCount`.

#### Scenario: Mutation invoked
- **WHEN** `autoGroupPhotosIntoWaves(uuid: String!)` is called via GraphQL
- **THEN** the system SHALL execute the auto-grouping logic for the specified user, update `photosCount` for each populated wave, and return an `AutoGroupResult` containing `wavesCreated` and `photosGrouped`

#### Scenario: AutoGroupResult type
- **WHEN** the mutation completes
- **THEN** the result SHALL conform to the GraphQL type `AutoGroupResult { wavesCreated: Int!, photosGrouped: Int! }`

---

### Requirement: Photo deletion cleans up wave associations
The system SHALL remove `WavePhotos` records when a photo is deleted. After cleanup, the system SHALL update `photosCount` for all affected waves. Global photo deletion SHALL be blocked if the photo belongs to a frozen wave.

#### Scenario: Deleted photo removed from waves
- **WHEN** a photo is soft-deleted via `deletePhoto` and the photo is in a non-frozen wave
- **THEN** the photo is marked `active = false` and `photosCount` is recalculated for the wave

#### Scenario: Photo in frozen wave cannot be deleted
- **WHEN** `deletePhoto` is called for a photo in a frozen wave
- **THEN** the system SHALL throw an error indicating the photo belongs to a frozen wave

---

### Requirement: Waves count query
The system SHALL provide a `getWavesCount(uuid)` query that returns the total number of waves the given device UUID belongs to. The controller SHALL validate the device `uuid` format using `assertValidUuid` before any database access and SHALL use parameterized SQL.

#### Scenario: User belongs to waves
- **WHEN** `getWavesCount(uuid)` is called with a valid UUID that belongs to 3 waves
- **THEN** the response SHALL be `3`

#### Scenario: User belongs to no waves
- **WHEN** `getWavesCount(uuid)` is called with a valid UUID that belongs to no waves
- **THEN** the response SHALL be `0`

#### Scenario: Invalid UUID rejected
- **WHEN** `getWavesCount(uuid)` is called with an invalid UUID format
- **THEN** the controller SHALL throw `Wrong UUID format for uuid: "<value>"` before executing any SQL query
