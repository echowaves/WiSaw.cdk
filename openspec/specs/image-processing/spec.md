## ADDED Requirements

### Requirement: Generate WebP image and thumbnail on upload
The system SHALL process every newly uploaded photo by converting it to a full-size WebP and a thumbnail WebP and storing both in S3.

#### Scenario: WebP conversion triggered by S3 event
- **WHEN** an object with a `.upload` suffix is created in the uploads S3 bucket
- **THEN** the `processUploadedImage` Lambda generates `<photoId>.webp` (full-size) and `<photoId>-thumb.webp` (thumbnail) and stores them in the bucket

#### Scenario: Thumbnail dimensions
- **WHEN** the thumbnail is generated
- **THEN** the image is resized so that the height is 300 pixels, preserving aspect ratio via `sharp`

---

### Requirement: Extract and persist image dimensions
The system SHALL extract width and height from every uploaded image and store them on the Photo record.

#### Scenario: Dimensions stored after processing
- **WHEN** `processUploadedImage` completes successfully
- **THEN** the `width` and `height` columns on the Photo record are populated with the actual pixel dimensions of the original image

---

### Requirement: Activate photo after processing
The system SHALL only make a photo visible in feeds after its processing pipeline completes successfully.

#### Scenario: Photo becomes active after pipeline
- **WHEN** all processing steps (WebP generation, dimension extraction, Rekognition) complete without error
- **THEN** the Photo record `active` flag is set to `true`, making it eligible to appear in all feed queries

#### Scenario: photo upload file is deleted after activation
- **WHEN** the photo is successfully activated
- **THEN** the original `.upload` object is deleted from S3

---

### Requirement: Process video uploads
The system SHALL handle video uploads separately from images via the `processUploadedPrivateImage` Lambda, storing the video for playback without image-specific transformations.

#### Scenario: Video processed on S3 event
- **WHEN** an object matching the private video upload pattern is created in S3
- **THEN** the `processUploadedPrivateImage` Lambda is triggered and processes the video file

---

### Requirement: Clean up S3 objects on photo deletion
The system SHALL delete all associated S3 objects (original, WebP, thumbnail, video) when a photo record is deleted.

#### Scenario: S3 objects deleted with photo
- **WHEN** a photo is deleted from the database
- **THEN** the `processDeletedImage` Lambda is triggered and removes all corresponding S3 keys for that photo
