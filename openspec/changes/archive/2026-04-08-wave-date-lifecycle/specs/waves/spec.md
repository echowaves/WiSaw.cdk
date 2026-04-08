## MODIFIED Requirements

### Requirement: Create a Wave
The system SHALL allow a device (identified by its `uuid`) to create a named content channel (Wave) with an optional description, geo-location, radius, `splashDate`, and `freezeDate`. The user MUST have a registered secret (a record in the `Secrets` table) to create a wave. The wave SHALL be created with `open = false` by default. If `splashDate` is not provided, it SHALL default to the current timestamp. If `freezeDate` is not provided, it SHALL default to 30 days from the current timestamp. The system SHALL validate that `freezeDate` is after `splashDate` and reject the request if not.

#### Scenario: Wave created without location
- **WHEN** `createWave(name, description, uuid)` is called without `lat`, `lon`, `radius`, `splashDate`, or `freezeDate` by a user with a registered secret
- **THEN** a Wave record is inserted with no location geometry stored, `open = false`, `splashDate = NOW()`, `freezeDate = NOW() + 30 days`, the creator is added to `WaveUsers` with `role = 'owner'`, and the new Wave is returned

#### Scenario: Wave created with location and radius
- **WHEN** `createWave` is called with `lat`, `lon`, and an optional `radius` by a user with a registered secret
- **THEN** the Wave record stores the location as a PostGIS point via `ST_MakePoint(lon, lat)` and the radius in kilometres (default 50 if omitted)

#### Scenario: Wave created with explicit dates
- **WHEN** `createWave` is called with `splashDate` and `freezeDate`
- **THEN** the Wave record SHALL store the provided dates

#### Scenario: Wave created with only splashDate
- **WHEN** `createWave` is called with `splashDate` but no `freezeDate`
- **THEN** `freezeDate` SHALL default to 30 days from the current timestamp

#### Scenario: Wave created with only freezeDate
- **WHEN** `createWave` is called with `freezeDate` but no `splashDate`
- **THEN** `splashDate` SHALL default to the current timestamp

#### Scenario: freezeDate before splashDate rejected
- **WHEN** `createWave` is called with `freezeDate` earlier than `splashDate`
- **THEN** the system SHALL throw an error indicating freezeDate must be after splashDate

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
The system SHALL allow the Wave owner to update its name, description, location, radius, open status, splashDate, and freezeDate. Only users with `role = 'owner'` in `WaveUsers` SHALL be able to update. When the wave is frozen (current time is past `freezeDate` or before `splashDate`), only `freezeDate` changes SHALL be allowed. To unfreeze a wave, the owner sets `freezeDate` to a future date.

#### Scenario: Wave updated by owner
- **WHEN** `updateWave(waveUuid, uuid, name, description, lat, lon, radius)` is called by the owner on an unfrozen wave
- **THEN** the Wave record is updated with the new values and the updated Wave is returned

#### Scenario: Non-owner cannot update
- **WHEN** `updateWave` is called by a facilitator or contributor
- **THEN** the system SHALL throw an error indicating insufficient permissions

#### Scenario: Frozen wave — only freezeDate allowed
- **WHEN** `updateWave` is called on a frozen wave with changes to `name`, `description`, `location`, `radius`, `open`, or `splashDate`
- **THEN** the system SHALL throw an error indicating the wave is frozen

#### Scenario: Frozen wave — unfreeze by extending freezeDate
- **WHEN** `updateWave(waveUuid, uuid, freezeDate: <future date>)` is called by the owner on a frozen wave
- **THEN** the wave SHALL be unfrozen (accepting contributions again)

#### Scenario: Owner toggles wave to open
- **WHEN** `updateWave(waveUuid, uuid, open: true)` is called by the owner
- **THEN** `Waves.open` SHALL be set to `true`

#### Scenario: Owner sets splash and freeze dates
- **WHEN** `updateWave(waveUuid, uuid, splashDate: <date>, freezeDate: <later date>)` is called by the owner on an unfrozen wave
- **THEN** `Waves.splashDate` and `Waves.freezeDate` SHALL be updated

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
The system SHALL return a paginated list of Waves that a given UUID is a member of, ordered by most recently updated. Each wave SHALL include up to 5 full `Photo` objects of its most recent active photos (with computed `imgUrl`, `thumbUrl`, `videoUrl` fields), `photosCount` read directly from the persisted column, and a computed `isFrozen` boolean.

#### Scenario: Waves listed with Photo objects limited to 5
- **WHEN** `listWaves(pageNumber, batch, uuid)` is called
- **THEN** each Wave in the response SHALL include a `photos` field containing at most 5 `Photo` objects for the most recent active photos, ordered by `updatedAt` descending. Each Photo SHALL include `id`, `uuid`, `location`, `commentsCount`, `watchersCount`, `createdAt`, `updatedAt`, `active`, `video`, `width`, `height`, `lastComment`, `imgUrl`, `thumbUrl`, `videoUrl`, and `row_number`.

#### Scenario: isFrozen computed from dates
- **WHEN** Waves are returned in the list
- **THEN** each Wave SHALL have `isFrozen` set to `true` if the current time is before `splashDate` or after `freezeDate`, otherwise `false`

#### Scenario: Waves listed with photosCount from column
- **WHEN** `listWaves(pageNumber, batch, uuid)` is called
- **THEN** each Wave in the response SHALL include `photosCount` from the `Waves` table column (not computed at query time)

#### Scenario: Wave with no photos
- **WHEN** a Wave has no associated photos in `WavePhotos` or all its photos are inactive
- **THEN** the `photos` field SHALL be an empty array and `photosCount` SHALL be 0

#### Scenario: No more data signal
- **WHEN** the number of returned Waves is less than the page size
- **THEN** `noMoreData` is `true`

---

### Requirement: Add a photo to a Wave
The system SHALL allow a Wave member to associate an existing photo with a Wave, subject to: the user must be a member and not banned, the wave must not be frozen (current time must be between `splashDate` and `freezeDate`), and the photo must be within geo-boundaries (if set). After the association is created, the system SHALL update the wave's `photosCount`. If the photo is currently in another wave, the system SHALL check if that source wave is frozen — if frozen, the move SHALL be blocked (unless the caller is the owner of the source wave).

#### Scenario: Photo added to Wave
- **WHEN** `addPhotoToWave(waveUuid, photoId, uuid)` is called by a member on an unfrozen wave and the photo is not in any wave
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
- **WHEN** `addPhotoToWave` is called on a wave where current time is past `freezeDate`
- **THEN** the system SHALL throw an error indicating the wave is frozen

#### Scenario: Photo rejected before splashDate
- **WHEN** `addPhotoToWave` is called on a wave whose `splashDate` is in the future
- **THEN** the system SHALL throw an error indicating the wave is frozen

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

## REMOVED Requirements

### Requirement: Wave-filtered feeds
**Reason**: Not modified by this change — remains as-is in the base spec.
**Migration**: No migration needed.

_Note: The "Wave-filtered feeds" and "Auto-group photos into waves mutation" requirements in the base spec are unchanged and not listed here._
