### Requirement: Report a photo within a wave
The system SHALL allow any wave member to report a photo within that wave via `reportWavePhoto(waveUuid, photoId, uuid)`. The report SHALL be stored as an `AbuseReport` with the `waveUuid` context and `status = 'pending'`.

#### Scenario: Wave photo reported
- **WHEN** `reportWavePhoto(waveUuid, photoId, uuid)` is called by a wave member
- **THEN** an `AbuseReport` record SHALL be created with the `photoId`, `uuid`, `waveUuid`, and `status = 'pending'`

#### Scenario: Non-member cannot report
- **WHEN** `reportWavePhoto` is called by a user who is not a member of the wave
- **THEN** the system SHALL throw an error indicating the user is not a wave member

### Requirement: Dismiss wave abuse report
The system SHALL allow owners and facilitators to dismiss a wave abuse report via `dismissWaveReport(reportId, uuid)`. The report's status SHALL be updated to `'dismissed'` with the reviewer's UUID and timestamp. Dismissing reports SHALL be blocked on frozen waves.

#### Scenario: Report dismissed
- **WHEN** `dismissWaveReport(reportId, uuid)` is called by an owner or facilitator on an unfrozen wave
- **THEN** the `AbuseReport.status` SHALL be set to `'dismissed'`, `reviewedBy` SHALL be set to the caller's UUID, `reviewedAt` SHALL be set to the current timestamp, and `true` SHALL be returned

#### Scenario: Contributor cannot dismiss
- **WHEN** `dismissWaveReport` is called by a contributor
- **THEN** the system SHALL throw an error indicating insufficient permissions

#### Scenario: Cannot dismiss on frozen wave
- **WHEN** `dismissWaveReport` is called on a frozen wave
- **THEN** the system SHALL throw an error indicating the wave is frozen

### Requirement: List wave abuse reports
The system SHALL provide a `listWaveAbuseReports(waveUuid, uuid)` query returning all abuse reports for a wave. Only owners and facilitators SHALL be able to list reports.

#### Scenario: Reports listed
- **WHEN** `listWaveAbuseReports(waveUuid, uuid)` is called by an owner or facilitator
- **THEN** all `AbuseReport` records with the matching `waveUuid` SHALL be returned with `id`, `photoId`, `uuid`, `status`, `reviewedBy`, `reviewedAt`, and `createdAt`

#### Scenario: Contributor cannot list reports
- **WHEN** `listWaveAbuseReports` is called by a contributor
- **THEN** the system SHALL throw an error indicating insufficient permissions

### Requirement: Ban user from wave
The system SHALL allow owners and facilitators to ban a contributor from an unfrozen wave via `banUserFromWave(waveUuid, targetUuid, uuid, reason?)`. Banning SHALL remove the user from `WaveUsers`, unlink all their photos from the wave, insert a `WaveBans` record, and update `photosCount` — all within a single transaction.

#### Scenario: User banned from wave
- **WHEN** `banUserFromWave(waveUuid, targetUuid, uuid)` is called by an owner or facilitator on an unfrozen wave against a contributor
- **THEN** within a single transaction: the target's `WavePhotos` entries SHALL be deleted, the target's `WaveUsers` record SHALL be deleted, a `WaveBans` record SHALL be inserted with the `bannedBy` UUID and optional `reason`, `photosCount` SHALL be recalculated, and `true` SHALL be returned

#### Scenario: Cannot ban facilitator (as facilitator)
- **WHEN** `banUserFromWave` is called by a facilitator against another facilitator
- **THEN** the system SHALL throw an error indicating insufficient permissions to ban a facilitator

#### Scenario: Owner can ban facilitator
- **WHEN** `banUserFromWave` is called by the owner against a facilitator
- **THEN** the ban SHALL proceed (owner can ban any non-owner member)

#### Scenario: Cannot ban owner
- **WHEN** `banUserFromWave` is called against the wave owner
- **THEN** the system SHALL throw an error indicating the owner cannot be banned

#### Scenario: Cannot ban on frozen wave
- **WHEN** `banUserFromWave` is called on a frozen wave
- **THEN** the system SHALL throw an error indicating the wave is frozen

### Requirement: List wave bans
The system SHALL provide a `listWaveBans(waveUuid, uuid)` query returning all banned users for a wave. Only owners and facilitators SHALL be able to list bans.

#### Scenario: Bans listed
- **WHEN** `listWaveBans(waveUuid, uuid)` is called by an owner or facilitator
- **THEN** all `WaveBans` records for the wave SHALL be returned with `uuid`, `bannedBy`, `reason`, and `createdAt`

#### Scenario: Contributor cannot list bans
- **WHEN** `listWaveBans` is called by a contributor
- **THEN** the system SHALL throw an error indicating insufficient permissions

### Requirement: Geo-boundary enforcement on photo add
When a wave has `location` and `radius` set, `addPhotoToWave` SHALL verify that the photo's location is within the wave's geo-boundary using PostGIS `ST_DWithin`. Photos without GPS data SHALL be rejected from geo-bounded waves.

#### Scenario: Photo within boundary accepted
- **WHEN** `addPhotoToWave` is called with a photo whose location is within `radius` km of the wave's location
- **THEN** the photo SHALL be added to the wave normally

#### Scenario: Photo outside boundary rejected
- **WHEN** `addPhotoToWave` is called with a photo whose location is more than `radius` km from the wave's location
- **THEN** the system SHALL throw an error indicating the photo is outside the wave's geo-boundaries

#### Scenario: Photo without GPS rejected from geo-bounded wave
- **WHEN** `addPhotoToWave` is called with a photo that has no location data on a wave with `location` and `radius` set
- **THEN** the system SHALL throw an error indicating the photo must have location data for this wave

#### Scenario: Wave without geo-boundaries — no check
- **WHEN** `addPhotoToWave` is called on a wave with `location = NULL`
- **THEN** no geo-boundary check SHALL be performed, regardless of the photo's location

### Requirement: Geo-boundary check utility
The system SHALL provide `_assertGeoBounds(waveUuid, photoId)` that uses `ST_DWithin(photo.location::geography, wave.location::geography, wave.radius * 1000)` (radius in km, ST_DWithin in meters). The check SHALL be skipped if the wave has no location set.

#### Scenario: Within boundary passes silently
- **WHEN** `_assertGeoBounds` is called for a photo within the wave's radius
- **THEN** the function SHALL return without error

#### Scenario: Outside boundary throws
- **WHEN** `_assertGeoBounds` is called for a photo outside the wave's radius
- **THEN** the function SHALL throw an error with a descriptive message
