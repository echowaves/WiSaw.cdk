## ADDED Requirements

### Requirement: Feed endpoints return shared PhotoFeed envelope
Feed queries return `photos`, `batch`, `noMoreData`, and `nextPage` according to each controller's pagination logic.

#### Scenario: Batch token round-trips
- **WHEN** client supplies batch token
- **THEN** response echoes same batch token

#### Scenario: Page has more data
- **WHEN** controller determines additional data is available
- **THEN** `noMoreData=false` and `nextPage` is non-null

### Requirement: Feed search uses shared buildSearchClause helper
Search filtering is built from Recognitions searchable text and active Comments text via `buildSearchClause`.

#### Scenario: Search term omitted
- **WHEN** search term is null/undefined
- **THEN** helper contributes no additional search filter

#### Scenario: Search term provided
- **WHEN** search term is provided
- **THEN** helper adds full-text filter over recognitions/comments

### Requirement: feedByDate supports search scan-ahead
With `searchTerm`, `feedByDate` scans forward windows until results/stop/cap; without `searchTerm`, it executes single-window behavior.

#### Scenario: Search finds matches in later window
- **WHEN** initial window has no matches but later window does
- **THEN** response returns matched window data and next continuation marker

#### Scenario: Scan reaches termination threshold
- **WHEN** stop condition is reached before matches
- **THEN** response returns no data with terminal pagination state

### Requirement: feedForTextSearch currently behaves as single-page
Current implementation returns one page and sets `noMoreData=true` and `nextPage=null`.

#### Scenario: Text search returns partial result set
- **WHEN** more records may exist beyond first page
- **THEN** controller still reports single-page terminal state

### Requirement: Navigation boundaries return null-photo payload
`getPhotoAllNext`/`getPhotoAllPrev` return `{ photo: null, comments: [], recognitions: [] }` when no neighboring photo exists.

#### Scenario: End of sequence on next navigation
- **WHEN** no newer photo exists
- **THEN** response contains null-photo payload

#### Scenario: Start of sequence on previous navigation
- **WHEN** no older photo exists
- **THEN** response contains null-photo payload
