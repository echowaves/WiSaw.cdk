## ADDED Requirements

### Requirement: Global and wave-context abuse reporting
`createAbuseReport(photoId, uuid)` creates global abuse reports (wave context and status rely on DB defaults). `reportWavePhoto(waveUuid, photoId, uuid)` creates wave-context abuse reports with pending status.

### Requirement: Scheduled cleanup removes stale reports
Cleanup lambda deletes abuse reports older than 7 days.

### Requirement: Upload blocking uses abuse threshold
`createPhoto` blocks uploads when abuse count for submitting uuid exceeds implemented threshold.
