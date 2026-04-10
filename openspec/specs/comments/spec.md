## ADDED Requirements

### Requirement: Create a comment on a photo
The system SHALL allow any device UUID to post a text comment on an active photo, provided the photo does not belong to a frozen wave.

#### Scenario: Comment successfully created
- **WHEN** `createComment(photoId, uuid, description)` is called with a non-empty description and the photo is not in a frozen wave
- **THEN** a Comment record is inserted with `active: true` and the supplied text, and the new Comment is returned

#### Scenario: Comment blocked on photo in frozen wave
- **WHEN** `createComment(photoId, uuid, description)` is called and the photo belongs to a frozen wave
- **THEN** the system SHALL throw an error indicating the photo belongs to a frozen wave and comments cannot be added

---

### Requirement: Delete a comment
The system SHALL allow the comment's author to delete their own comment, provided the comment's photo does not belong to a frozen wave.

#### Scenario: Author deletes comment
- **WHEN** `deleteComment(commentId, uuid)` is called by the UUID that created the comment and the photo is not in a frozen wave
- **THEN** the Comment record is removed and the string `"OK"` is returned

#### Scenario: Delete blocked on photo in frozen wave
- **WHEN** `deleteComment(commentId, uuid)` is called and the comment's photo belongs to a frozen wave
- **THEN** the system SHALL throw an error indicating the photo belongs to a frozen wave and comments cannot be removed

---

### Requirement: Maintain photo comments count
The system SHALL keep the `commentsCount` on a Photo record in sync with the number of active comments.

#### Scenario: Count increments on create
- **WHEN** a new comment is created
- **THEN** `commentsCount` on the associated Photo record is incremented by 1

#### Scenario: Count decrements on delete
- **WHEN** a comment is deleted
- **THEN** `commentsCount` on the associated Photo record is decremented by 1

---

### Requirement: Maintain last comment snapshot
The system SHALL store the text of the most recent comment on the Photo record for display in feeds without a separate query.

#### Scenario: Last comment updated on create
- **WHEN** a new comment is created
- **THEN** the `lastComment` field on the Photo record is updated to the new comment's text

#### Scenario: Last comment cleared on delete
- **WHEN** the only or most recent comment is deleted
- **THEN** `lastComment` on the Photo record is updated to the text of the previous comment, or cleared if no comments remain

---

### Requirement: Notify watchers on new comment
The system SHALL notify all watchers of a photo when a new comment is posted.

#### Scenario: All watchers notified
- **WHEN** a comment is created on a photo
- **THEN** push notifications are sent to all UUIDs watching that photo
