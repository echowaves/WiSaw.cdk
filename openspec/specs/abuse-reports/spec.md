## ADDED Requirements

### Requirement: Global and wave-context abuse reporting
`createAbuseReport(photoId, uuid)` creates global abuse reports (wave context and status rely on DB defaults). `reportWavePhoto(waveUuid, photoId, uuid)` creates wave-context abuse reports with pending status.

#### Scenario: Global report creation
- **WHEN** user reports photo outside wave-specific moderation flow
- **THEN** global abuse row is inserted with DB-default context fields

#### Scenario: Wave-context report creation
- **WHEN** wave member reports photo via wave moderation flow
- **THEN** abuse row includes waveUuid and pending status

### Requirement: Scheduled cleanup removes stale reports
Cleanup lambda deletes abuse reports older than 7 days.

#### Scenario: Daily cleanup pass
- **WHEN** scheduled cleanup lambda runs
- **THEN** rows older than 7 days are removed

### Requirement: Upload blocking uses abuse threshold
`createPhoto` blocks uploads when abuse count for submitting uuid exceeds implemented threshold.

#### Scenario: Threshold exceeded
- **WHEN** abuse count query returns over-limit total
- **THEN** photo creation is rejected

#### Scenario: Under threshold
- **WHEN** abuse count is within limit
- **THEN** upload flow may proceed
