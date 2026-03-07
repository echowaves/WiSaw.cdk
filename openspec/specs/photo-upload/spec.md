## ADDED Requirements

### Requirement: Generate presigned upload URL
The system SHALL generate a presigned S3 PUT URL for a given asset key and content type, valid for 1 hour, that the client uses to upload a photo or video directly to S3.

#### Scenario: Client requests upload URL
- **WHEN** a client calls `generateUploadUrl(assetKey, contentType)`
- **THEN** the system returns a time-limited presigned S3 URL that allows a single PUT of the specified content type

#### Scenario: URL expires after 1 hour
- **WHEN** a presigned upload URL is issued
- **THEN** the URL SHALL be valid for exactly 3600 seconds and rejected by S3 after expiry

---

### Requirement: Create photo record with GPS coordinates
The system SHALL create a Photo record in the database upon `createPhoto` mutation, storing the device UUID, GPS coordinates as a PostGIS point, video flag, and timestamps.

#### Scenario: Successful photo creation
- **WHEN** a client calls `createPhoto(uuid, lat, lon, video)` with valid inputs
- **THEN** a Photo record is inserted with the provided coordinates stored via `ST_MakePoint(lon, lat)`, active set to false, and the creator is automatically added as a watcher

#### Scenario: Video photo creation
- **WHEN** `createPhoto` is called with `video: true`
- **THEN** the Photo record SHALL have `video = true` stored in the database

---

### Requirement: Abuse-check gate on photo creation
The system SHALL prevent users whose previous photos have accumulated more than 3 abuse reports from creating new photos.

#### Scenario: User is banned after excessive abuse reports
- **WHEN** `createPhoto` is called and the device UUID has more than 3 abuse reports across all its photos
- **THEN** the system SHALL throw an error with message "You are banned" and no photo record is created

#### Scenario: User below ban threshold can upload
- **WHEN** `createPhoto` is called and the device UUID has 3 or fewer abuse reports
- **THEN** the photo creation proceeds normally

---

### Requirement: Creator auto-watches their photo
The system SHALL automatically add a Watcher record for the creator when a new photo is created.

#### Scenario: Creator is added as watcher on create
- **WHEN** a photo is created via `createPhoto`
- **THEN** a Watcher record for that photo and UUID SHALL be inserted immediately after the photo record is created

---

### Requirement: Delete own photo
The system SHALL allow the owner of a photo to delete it, which triggers downstream S3 object cleanup.

#### Scenario: Owner deletes a photo
- **WHEN** `deletePhoto(photoId, uuid)` is called by the photo's owner UUID
- **THEN** the Photo record is deleted and associated S3 objects (image, thumbnail, video) are removed via the `processDeletedImage` Lambda
