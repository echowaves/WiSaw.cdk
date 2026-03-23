## MODIFIED Requirements

### Requirement: S3 delete trigger cleanup
When an S3 object is deleted, the `processDeletedImage` Lambda SHALL delete all related database records in the correct order to satisfy foreign key constraints. Dependent records (`WavePhotos`, `Watchers`, `Recognitions`, `Comments`) SHALL be deleted before the `Photos` record. All SQL queries SHALL use parameterized queries to prevent SQL injection.

#### Scenario: Photo belongs to a wave
- **WHEN** an S3 object is deleted and the photo belongs to one or more waves
- **THEN** the system SHALL delete `WavePhotos` records first, update `photosCount` on affected waves, then delete `Watchers`, `Recognitions`, `Comments`, and finally the `Photos` record

#### Scenario: Photo does not belong to a wave
- **WHEN** an S3 object is deleted and the photo does not belong to any wave
- **THEN** the system SHALL delete `Watchers`, `Recognitions`, `Comments`, and then the `Photos` record successfully

#### Scenario: SQL injection prevention
- **WHEN** the `photoId` is extracted from the S3 object key
- **THEN** the system SHALL use parameterized queries (`$1`) for all database operations instead of string interpolation
