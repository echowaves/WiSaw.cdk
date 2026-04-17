## ADDED Requirements

### Requirement: Feed endpoints return shared PhotoFeed envelope
Feed queries return `photos`, `batch`, `noMoreData`, and `nextPage` according to each controller's pagination logic.

### Requirement: Feed search uses shared buildSearchClause helper
Search filtering is built from Recognitions searchable text and active Comments text via `buildSearchClause`.

### Requirement: feedByDate supports search scan-ahead
With `searchTerm`, `feedByDate` scans forward windows until results/stop/cap; without `searchTerm`, it executes single-window behavior.

### Requirement: feedForTextSearch currently behaves as single-page
Current implementation returns one page and sets `noMoreData=true` and `nextPage=null`.

### Requirement: Navigation boundaries return null-photo payload
`getPhotoAllNext`/`getPhotoAllPrev` return `{ photo: null, comments: [], recognitions: [] }` when no neighboring photo exists.
