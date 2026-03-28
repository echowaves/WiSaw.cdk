## ADDED Requirements

### Requirement: Photo navigation boundary handling
When navigating to the next or previous photo and no such photo exists (i.e., the user is at the beginning or end of the feed), the system SHALL return a response with `photo: null`, `comments: []`, and `recognitions: []` without executing any database queries for photo details, comments, or recognitions. The system SHALL NOT pass invalid or placeholder IDs to downstream queries.

#### Scenario: No next photo exists
- **WHEN** `getPhotoAllNext(photoId)` is called and no active photo has a newer `updatedAt` than the given photo
- **THEN** the response SHALL be `{ photo: null, comments: [], recognitions: [] }`

#### Scenario: No previous photo exists
- **WHEN** `getPhotoAllPrev(photoId)` is called and no active photo has an older `updatedAt` than the given photo
- **THEN** the response SHALL be `{ photo: null, comments: [], recognitions: [] }`

#### Scenario: Next photo exists
- **WHEN** `getPhotoAllNext(photoId)` is called and a newer active photo exists
- **THEN** the response SHALL contain the next photo's details, comments, and recognitions

#### Scenario: Previous photo exists
- **WHEN** `getPhotoAllPrev(photoId)` is called and an older active photo exists
- **THEN** the response SHALL contain the previous photo's details, comments, and recognitions
