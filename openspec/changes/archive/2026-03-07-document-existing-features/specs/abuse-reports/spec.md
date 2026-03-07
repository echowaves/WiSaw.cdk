## ADDED Requirements

### Requirement: Report a photo for abuse
The system SHALL allow any device UUID to submit an abuse report against a photo.

#### Scenario: Abuse report created
- **WHEN** `createAbuseReport(photoId, uuid)` is called
- **THEN** an AbuseReport record is created linking the photo to the reporting UUID, and the new record is returned

---

### Requirement: Automatic expiry of old abuse reports
The system SHALL automatically purge AbuseReport records older than 7 days via a scheduled Lambda.

#### Scenario: Old reports deleted on schedule
- **WHEN** the `cleaupupAbuseReports` Lambda is triggered (scheduled)
- **THEN** all AbuseReport records with `createdAt < NOW() - INTERVAL '7 days'` are deleted from the database

---

### Requirement: Ban users with excessive abuse reports
The system SHALL prevent photo uploads from device UUIDs whose photos have accumulated more than 3 abuse reports.

#### Scenario: User banned after threshold exceeded
- **WHEN** `createPhoto` is called and the reporting query returns a count greater than 3 for the submitting UUID
- **THEN** the system throws an error and no photo is created (see also `photo-upload` spec)
