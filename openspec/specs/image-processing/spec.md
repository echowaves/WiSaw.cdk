## ADDED Requirements

### Requirement: Upload processing generates web derivatives
`processUploadedImage` converts `.upload` source to `<photoId>.webp` and `<photoId>-thumb.webp` (thumb height 300) and stores them in S3.

### Requirement: Dimensions and recognitions are persisted
Pipeline extracts width/height and persists recognition metadata plus searchable text.

### Requirement: Photo activates after successful pipeline
Photo is marked active after processing succeeds, then original `.upload` object is deleted.

### Requirement: Deletion cleanup is FK-safe and parameterized
`processDeletedImage` removes dependent rows (`WavePhotos`, `Watchers`, `Recognitions`, `Comments`) before deleting `Photos`, using parameterized SQL.
