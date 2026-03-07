## ADDED Requirements

### Requirement: Watch a photo
The system SHALL allow a device UUID to subscribe to a photo as a watcher, updating the photo's watcher count.

#### Scenario: User watches a photo
- **WHEN** `watchPhoto(photoId, uuid)` is called
- **THEN** an upsert is performed in `Watchers` (existing row deleted then re-inserted) and the `watchersCount` on the Photo record is updated to reflect the current total; the new count is returned

#### Scenario: Duplicate watch is idempotent
- **WHEN** `watchPhoto` is called for a photo the user is already watching
- **THEN** the previous Watcher record is replaced and the count remains accurate

---

### Requirement: Unwatch a photo
The system SHALL allow a device UUID to remove themselves as a watcher from a photo.

#### Scenario: User unwatches a photo
- **WHEN** `unwatchPhoto(photoId, uuid)` is called
- **THEN** the Watcher record is deleted and `watchersCount` on the Photo record is decremented to the current total

---

### Requirement: Check if photo is watched
The system SHALL report whether a given UUID is currently watching a photo.

#### Scenario: Photo details include watch status
- **WHEN** `getPhotoDetails(photoId, uuid)` is called
- **THEN** `isPhotoWatched` in the `PhotoDetails` response is `true` if a Watcher record exists for that photo and UUID, and `false` otherwise

---

### Requirement: Notify watchers on new comment
The system SHALL notify all current watchers of a photo whenever a new comment is posted.

#### Scenario: Watchers receive notification on comment
- **WHEN** a new comment is created on a photo
- **THEN** the system SHALL send a notification to every UUID that has a Watcher record for that photo (excluding the commenter themselves)
