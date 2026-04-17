## ADDED Requirements

### Requirement: Create comment on mutable photo context
`createComment(photoId, uuid, description)` SHALL require non-empty description and SHALL reject photos in frozen waves.

#### Scenario: Empty description rejected
- **WHEN** description is empty or blank
- **THEN** create request fails before comment insert

#### Scenario: Valid comment created
- **WHEN** description is non-empty and photo is mutable
- **THEN** active comment row is inserted and returned

### Requirement: Delete comment is author-only soft delete
`deleteComment(commentId, uuid)` SHALL require author ownership, reject frozen-wave photos, set comment `active=false` and `deactivatedBy`, and return updated `lastComment` value.

#### Scenario: Non-author delete rejected
- **WHEN** caller is not comment creator
- **THEN** delete request fails

#### Scenario: Author soft delete succeeds
- **WHEN** caller is comment creator and photo is mutable
- **THEN** comment is deactivated and `lastComment` recomputation result is returned

### Requirement: Comment denormalized fields stay synchronized
Create/delete flows SHALL update `commentsCount` and `lastComment` on the related photo.

#### Scenario: Create increments count
- **WHEN** comment is inserted
- **THEN** photo `commentsCount` increases by one

#### Scenario: Delete decrements count
- **WHEN** comment is soft-deleted
- **THEN** photo `commentsCount` decreases and `lastComment` is recalculated

### Requirement: New comment updates watcher notification marker
On comment creation, `_notifyAllWatchers` updates `watchedAt` for watchers of the photo.

#### Scenario: Watcher timestamps touched
- **WHEN** comment is created
- **THEN** watcher rows for that photo get updated `watchedAt`