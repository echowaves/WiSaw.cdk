## ADDED Requirements

### Requirement: Query photo by ID (device-authenticated)
The system SHALL provide a GraphQL query `getPhotoById(photoId: String!, uuid: String!)` that returns a `Photo` object for a photo with the given ID, but only when the calling device (`uuid`) matches the device that originally uploaded the photo. This prevents arbitrary devices from discovering or accessing photo metadata.

#### Scenario: Photo found by own device
- **WHEN** a client calls `getPhotoById(photoId: "<uuid>", uuid: "<own-device-uuid>")` for a photo that exists and was uploaded by that device
- **THEN** the system returns the `Photo` object including `id`, `uuid`, `active`, `imgUrl`, `thumbUrl`, `video`, and other metadata

#### Scenario: Photo not found by ID
- **WHEN** a client calls `getPhotoById(photoId: "<uuid>", uuid: "<device-uuid>")` for a photo that does not exist
- **THEN** the system returns `null`

#### Scenario: Photo exists but belongs to different device
- **WHEN** a client calls `getPhotoById(photoId: "<other-photo-id>", uuid: "<wrong-device-uuid>")` where the photo was uploaded by a different device
- **THEN** the system returns `null` (same as not found — do not reveal photo existence to unauthorized devices)

#### Scenario: Photo ID is case-sensitive UUID string
- **WHEN** a client calls `getPhotoById` with valid UUID format strings for both parameters
- **THEN** the system performs an exact match query on the `Photos` table filtering by both `id` and `uuid` columns

---

### Requirement: Required photoId parameter on createPhoto mutation
The system SHALL require a `photoId` parameter on the `createPhoto` mutation. The system uses the client-provided `photoId` as the primary key for the new photo record.

#### Scenario: createPhoto with new photoId creates photo
- **WHEN** `createPhoto(photoId: "<uuid>", uuid: "...", lat: 0, lon: 0, video: false)` is called with a `photoId` that does not exist
- **THEN** a new Photo record is inserted with `id = photoId`
- **AND** the abuse report check is performed
- **AND** the creator is automatically added as a watcher

#### Scenario: createPhoto with existing photoId returns existing
- **WHEN** `createPhoto(photoId: "<existing-uuid>", uuid: "...", lat: 0, lon: 0, video: false)` is called with a `photoId` that already exists
- **THEN** the system returns the existing photo record without creating a duplicate
- **AND** no abuse report check is performed (the photo was already created and passed the check at creation time)
- **AND** no watcher update is performed (the creator was already added at creation time)

#### Scenario: createPhoto without photoId fails validation
- **WHEN** `createPhoto(uuid: "...", lat: 0, lon: 0, video: false)` is called without a `photoId` parameter
- **THEN** the system rejects the request with a GraphQL validation error indicating `photoId` is required

#### Scenario: Duplicate photoId by different client is rejected by database
- **WHEN** `createPhoto(photoId: "<uuid>", ...)` is called and another concurrent request already created a photo with that ID
- **THEN** the database UNIQUE constraint on `Photos.id` prevents the duplicate
- **AND** the GraphQL layer catches the error and returns the existing photo to the client
