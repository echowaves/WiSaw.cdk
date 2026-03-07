## ADDED Requirements

### Requirement: Auto-run Rekognition on image upload
The system SHALL automatically run AWS Rekognition label detection, moderation label detection, and text detection on every uploaded photo immediately after the image is available in S3.

#### Scenario: Labels detected and stored
- **WHEN** a photo upload event triggers the `processUploadedImage` Lambda
- **THEN** `DetectLabelsCommand` is called on the uploaded image and the resulting labels are stored as a JSON `metaData` blob in a `Recognitions` record linked to the photo

#### Scenario: Moderation labels detected
- **WHEN** `processUploadedImage` runs
- **THEN** `DetectModerationLabelsCommand` results are included in the stored recognition metadata

#### Scenario: Text detected in image
- **WHEN** `processUploadedImage` runs
- **THEN** `DetectTextCommand` results are included in the stored recognition metadata

---

### Requirement: Recognitions linked to photo
The system SHALL associate each Rekognition result with its photo via a `photoId` foreign key so they can be retrieved and searched.

#### Scenario: Recognitions returned with photo details
- **WHEN** `getPhotoDetails(photoId, uuid)` is called
- **THEN** the `recognitions` array in `PhotoDetails` contains all stored `Recognition` records for that photo

#### Scenario: Recognitions used in text search
- **WHEN** `feedForTextSearch(searchTerm, ...)` is called
- **THEN** photos whose `Recognitions.metaData` contains the search term (via full-text index) are included in the results
