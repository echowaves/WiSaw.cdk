## ADDED Requirements

### Requirement: Shared pagination utility handles connection lifecycle
All photo feed controllers use `fetchPaginatedPhotos()` which manages `psql.connect()`/`clean()` with try/finally, maps rows via `plainToClass(Photo)`, and computes `noMoreData`/`nextPage`.

#### Scenario: Batch token round-trips
- **WHEN** client supplies batch token
- **THEN** response echoes same batch token

#### Scenario: Page has more data
- **WHEN** `photos.length >= batchSize` and `noMoreDataOverride` is not set
- **THEN** `noMoreData=false` and `nextPage=pageNumber+1`

#### Scenario: Page is last
- **WHEN** `photos.length < batchSize` and `noMoreDataOverride` is not set
- **THEN** `noMoreData=true` and `nextPage=null`

#### Scenario: noMoreDataOverride forces single-page
- **WHEN** `noMoreDataOverride=true` is passed to utility
- **THEN** `noMoreData=true` and `nextPage=null` regardless of `photos.length`

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

### Requirement: feedForTextSearch returns single-page results
The feedForTextSearch controller passes `noMoreDataOverride: true` to the shared utility, which forces `noMoreData=true` and `nextPage=null` regardless of result count. This preserves the existing single-page behavior while using the shared pagination infrastructure.

#### Scenario: Text search returns partial result set
- **WHEN** more records may exist beyond first page
- **THEN** utility forces `noMoreData=true` and `nextPage=null` via `noMoreDataOverride` flag

### Requirement: Navigation boundaries return null-photo payload
`getPhotoAllNext`/`getPhotoAllPrev` return `{ photo: null, comments: [], recognitions: [] }` when no neighboring photo exists.

#### Scenario: End of sequence on next navigation
- **WHEN** no newer photo exists
- **THEN** response contains null-photo payload

#### Scenario: Start of sequence on previous navigation
- **WHEN** no older photo exists
- **THEN** response contains null-photo payload
