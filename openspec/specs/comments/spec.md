## ADDED Requirements

### Requirement: Create comment on mutable photo context
`createComment(photoId, uuid, description)` SHALL require non-empty description and SHALL reject photos in frozen waves.

### Requirement: Delete comment is author-only soft delete
`deleteComment(commentId, uuid)` SHALL require author ownership, reject frozen-wave photos, set comment `active=false` and `deactivatedBy`, and return updated `lastComment` value.

### Requirement: Comment denormalized fields stay synchronized
Create/delete flows SHALL update `commentsCount` and `lastComment` on the related photo.

### Requirement: New comment updates watcher notification marker
On comment creation, `_notifyAllWatchers` updates `watchedAt` for watchers of the photo.