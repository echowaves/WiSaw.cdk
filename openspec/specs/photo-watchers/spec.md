## ADDED Requirements

### Requirement: watch/unwatch maintain Watchers and counters
`watchPhoto` uses delete-then-insert upsert semantics and updates `watchersCount`. `unwatchPhoto` deletes watcher row and updates count.

#### Scenario: Re-watch remains idempotent
- **WHEN** user watches photo already watched
- **THEN** final watcher set remains single row for that uuid and count stays correct

#### Scenario: Unwatch removes watcher row
- **WHEN** user unwatch request succeeds
- **THEN** watcher row is removed and count reflects new total

### Requirement: Watch status is available in photo details
Photo details include whether the requesting uuid is currently watching the photo.

#### Scenario: Watched photo details
- **WHEN** watcher row exists for requester and photo
- **THEN** details include watched=true flag

#### Scenario: Unwatched photo details
- **WHEN** watcher row does not exist
- **THEN** details include watched=false flag

### Requirement: Comment activity updates watcher timestamps
On comment creation, `_notifyAllWatchers` updates `watchedAt` for watchers of that photo.

#### Scenario: Comment touches watcher activity marker
- **WHEN** new comment is posted
- **THEN** watcher timestamps are updated for that photo's watcher set
