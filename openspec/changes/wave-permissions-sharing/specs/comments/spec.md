## MODIFIED Requirements

### Requirement: Create a comment on a photo
The system SHALL allow any device UUID to post a text comment on an active photo, provided the photo does not belong to a frozen wave.

#### Scenario: Comment successfully created
- **WHEN** `createComment(photoId, uuid, description)` is called with a non-empty description and the photo is not in a frozen wave
- **THEN** a Comment record is inserted with `active: true` and the supplied text, and the new Comment is returned

#### Scenario: Comment blocked on photo in frozen wave
- **WHEN** `createComment(photoId, uuid, description)` is called and the photo belongs to a frozen wave
- **THEN** the system SHALL throw an error indicating the photo belongs to a frozen wave and comments cannot be added

### Requirement: Delete a comment
The system SHALL allow the comment's author to delete their own comment, provided the comment's photo does not belong to a frozen wave.

#### Scenario: Author deletes comment
- **WHEN** `deleteComment(commentId, uuid)` is called by the UUID that created the comment and the photo is not in a frozen wave
- **THEN** the Comment record is removed and the string `"OK"` is returned

#### Scenario: Delete blocked on photo in frozen wave
- **WHEN** `deleteComment(commentId, uuid)` is called and the comment's photo belongs to a frozen wave
- **THEN** the system SHALL throw an error indicating the photo belongs to a frozen wave and comments cannot be removed
