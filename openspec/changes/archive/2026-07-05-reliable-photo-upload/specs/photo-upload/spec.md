## MODIFIED Requirements

### Requirement: Create photo record with GPS coordinates
The system SHALL create a Photo record in the database upon `createPhoto` mutation, storing the device UUID, GPS coordinates as a PostGIS point, video flag, and timestamps. The mutation requires a `photoId` parameter that is used as the primary key.

#### Scenario: Successful photo creation with client-provided ID
- **WHEN** a client calls `createPhoto(photoId: "<uuid>", uuid, lat, lon, video)` with a `photoId` parameter
- **THEN** a Photo record is inserted with `id = photoId`, the provided coordinates stored via `ST_MakePoint(lon, lat)`, `active` set to false, and the creator is automatically added as a watcher
- **AND** the abuse report check is performed before insertion

#### Scenario: Idempotent photo creation returns existing
- **WHEN** `createPhoto(photoId: "<existing-uuid>", uuid, lat, lon, video)` is called with a `photoId` that already exists in the database
- **THEN** the system returns the existing photo record without modifying it
- **AND** no duplicate watcher is inserted
- **AND** no abuse report check is performed

#### Scenario: Video photo creation with client ID
- **WHEN** `createPhoto` is called with `photoId: "<uuid>"` and `video: true`
- **THEN** the Photo record SHALL have `video = true` and `id = photoId` stored in the database
