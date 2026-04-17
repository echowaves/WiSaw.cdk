## ADDED Requirements

### Requirement: watch/unwatch maintain Watchers and counters
`watchPhoto` uses delete-then-insert upsert semantics and updates `watchersCount`. `unwatchPhoto` deletes watcher row and updates count.

### Requirement: Watch status is available in photo details
Photo details include whether the requesting uuid is currently watching the photo.

### Requirement: Comment activity updates watcher timestamps
On comment creation, `_notifyAllWatchers` updates `watchedAt` for watchers of that photo.
