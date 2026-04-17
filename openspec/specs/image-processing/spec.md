## ADDED Requirements

### Requirement: Upload processing generates web derivatives
`processUploadedImage` converts `.upload` source to `<photoId>.webp` and `<photoId>-thumb.webp` (thumb height 300) and stores them in S3.

#### Scenario: Upload object triggers transform pipeline
- **WHEN** S3 create event arrives for `.upload` key
- **THEN** derivative web assets are generated and written to bucket

#### Scenario: Thumbnail preserves aspect ratio
- **WHEN** thumbnail is generated with fixed height
- **THEN** width scales proportionally from original image

### Requirement: Dimensions and recognitions are persisted
Pipeline extracts width/height and persists recognition metadata plus searchable text.

#### Scenario: Dimension metadata persisted to photo row
- **WHEN** image metadata extraction succeeds
- **THEN** `width` and `height` are updated on photo record

#### Scenario: Recognition text feeds search index data
- **WHEN** recognition outputs are stored
- **THEN** searchable text column is populated for feed search queries

### Requirement: Photo activates after successful pipeline
Photo is marked active after processing succeeds, then original `.upload` object is deleted.

#### Scenario: Activation after all steps succeed
- **WHEN** transform and persistence steps complete without error
- **THEN** photo becomes active and source upload artifact is removed

### Requirement: Deletion cleanup is FK-safe and parameterized
`processDeletedImage` removes dependent rows (`WavePhotos`, `Watchers`, `Recognitions`, `Comments`) before deleting `Photos`, using parameterized SQL.

#### Scenario: Dependency-first deletion order
- **WHEN** delete cleanup runs
- **THEN** child table rows are removed before parent photo row

#### Scenario: SQL injection-safe delete inputs
- **WHEN** photoId is derived from event key
- **THEN** SQL operations use placeholders and values arrays
