## MODIFIED Requirements

### Requirement: Report a photo for abuse
The system SHALL allow any device UUID to submit an abuse report against a photo. When reporting within a wave context, the report SHALL include the `waveUuid` and be created with `status = 'pending'`.

#### Scenario: Abuse report created (global)
- **WHEN** `createAbuseReport(photoId, uuid)` is called
- **THEN** an AbuseReport record is created linking the photo to the reporting UUID with `waveUuid = NULL` and `status = 'pending'`, and the new record is returned

#### Scenario: Abuse report created (wave context)
- **WHEN** `reportWavePhoto(waveUuid, photoId, uuid)` is called by a wave member
- **THEN** an AbuseReport record is created with the `photoId`, `uuid`, `waveUuid`, and `status = 'pending'`
