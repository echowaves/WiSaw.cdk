## ADDED Requirements

### Requirement: PhotoFeed nextPage field
The `PhotoFeed` GraphQL type SHALL include a nullable `nextPage: Int` field. When results are returned, `nextPage` SHALL indicate the value the client should pass as the pagination parameter (pageNumber or daysAgo, depending on the feed) for the next request. When `noMoreData` is true, `nextPage` SHALL be null.

#### Scenario: Feed returns results
- **WHEN** any feed query returns a non-empty photos array
- **THEN** `nextPage` SHALL be set to the next pagination value the client should use

#### Scenario: Feed has no more data
- **WHEN** any feed query determines there is no more data
- **THEN** `noMoreData` SHALL be true and `nextPage` SHALL be null

#### Scenario: Feed returns empty due to iteration cap
- **WHEN** `feedByDate` with a searchTerm exhausts its scan-ahead iteration cap without finding results and has not reached `whenToStop`
- **THEN** `noMoreData` SHALL be false and `nextPage` SHALL point to the next unscanned window so the client can resume

---

### Requirement: feedByDate search scan-ahead
When `feedByDate` is called with a non-null `searchTerm` and the initial 15-day window returns zero results, the server SHALL loop internally — incrementing `daysAgo` and re-querying — until one of three conditions is met: (1) results are found, (2) the date window passes `whenToStop`, or (3) a maximum of 10 iterations is reached. Without a `searchTerm`, no loop SHALL occur.

#### Scenario: Search results found on first iteration
- **WHEN** `feedByDate` is called with a searchTerm and the first 15-day window contains matching photos
- **THEN** the server returns those photos with `nextPage` set to `daysAgo + 1`

#### Scenario: Search results found on later iteration
- **WHEN** `feedByDate` is called with a searchTerm and iterations 0 through N-1 return empty but iteration N finds results
- **THEN** the server returns iteration N's photos with `nextPage` set to the `daysAgo` value of the next unscanned window

#### Scenario: whenToStop reached during scan-ahead
- **WHEN** `feedByDate` is scanning ahead with a searchTerm and the date window passes `whenToStop` before finding results
- **THEN** the server returns empty photos with `noMoreData: true` and `nextPage: null`

#### Scenario: Iteration cap exhausted
- **WHEN** `feedByDate` reaches 10 iterations without finding results and has not passed `whenToStop`
- **THEN** the server returns empty photos with `noMoreData: false` and `nextPage` set to the next unscanned `daysAgo` value

#### Scenario: No search term provided
- **WHEN** `feedByDate` is called without a searchTerm
- **THEN** no scan-ahead loop occurs, behavior is identical to pre-change except `nextPage` is set to `daysAgo + 1`

## MODIFIED Requirements

### Requirement: Feed by date and location
The system SHALL return photos from a sliding date window centered on a location, ordered by creation time descending. The query SHALL use parameterized SQL for all interpolated values including coordinates, date boundaries, and pagination limits. The controller SHALL validate that `lat` and `lon` are finite numbers. The query SHALL accept an optional `searchTerm` parameter (nullable, not required by GraphQL schema or controller signature); when provided, results SHALL be filtered to only photos matching the full-text search and the server SHALL scan ahead through successive date windows until results are found, `whenToStop` is reached, or an iteration cap is hit. When `searchTerm` is omitted or null, behavior SHALL be identical to the pre-change implementation. The response SHALL include `nextPage` indicating the next `daysAgo` value for the client to use.

#### Scenario: Retrieve feed for a given day
- **WHEN** `feedByDate(daysAgo, lat, lon, batch, whenToStop)` is called without a search term
- **THEN** the system returns up to 1000 active photos created within a 1-day window `daysAgo` days before now, each annotated with distance from the provided coordinates, with `nextPage` set to `daysAgo + 1`

#### Scenario: No more data signal
- **WHEN** the date window passes `whenToStop`
- **THEN** `noMoreData` is set to `true` and `nextPage` is set to `null`

#### Scenario: Feed by date filtered by search term
- **WHEN** `feedByDate(daysAgo, lat, lon, batch, whenToStop, searchTerm)` is called with a non-null `searchTerm`
- **THEN** the system scans successive 15-day windows starting from `daysAgo` until matching photos are found, returning those photos with `nextPage` pointing to the next unscanned window

---

### Requirement: Watcher feed
The system SHALL return a paginated feed of photos that a given device `uuid` is watching, ordered by most recently updated first. The controller SHALL validate the device `uuid` format before querying and SHALL use parameterized SQL for all values. The query SHALL accept an optional `searchTerm` parameter (nullable, not required by GraphQL schema or controller signature); when provided, results SHALL be filtered to only photos matching the full-text search. When `searchTerm` is omitted or null, behavior SHALL be identical to the pre-change implementation. The response SHALL include `nextPage` set to `pageNumber + 1` when results exist, or `null` when `noMoreData` is true.

#### Scenario: Retrieve watcher feed page
- **WHEN** `feedForWatcher(uuid, pageNumber, batch)` is called with a valid device `uuid` and no search term
- **THEN** the system returns up to the configured page size of active photos watched by that device in descending update order, with `nextPage` set to `pageNumber + 1`

#### Scenario: Invalid device uuid rejected
- **WHEN** `feedForWatcher` is called with an invalid `uuid` format
- **THEN** the controller SHALL throw a validation error before executing any SQL query

#### Scenario: Watcher feed filtered by search term
- **WHEN** `feedForWatcher(uuid, pageNumber, batch, searchTerm)` is called with a non-null `searchTerm`
- **THEN** the system returns only watched photos whose Recognitions metadata or Comments text match the search term via PostgreSQL full-text search, with `nextPage` set to `pageNumber + 1`

#### Scenario: No more watcher results
- **WHEN** the returned photos count is less than the page size
- **THEN** `noMoreData` SHALL be true and `nextPage` SHALL be null

---

### Requirement: Recent feed
The system SHALL return a paginated feed of the most recently uploaded active photos, globally. The query SHALL use parameterized SQL for pagination values. The query SHALL accept an optional `searchTerm` parameter (nullable, not required by GraphQL schema or controller signature); when provided, results SHALL be filtered to only photos matching the full-text search. When `searchTerm` is omitted or null, behavior SHALL be identical to the pre-change implementation. The response SHALL include `nextPage` set to `pageNumber + 1` when results exist, or `null` when `noMoreData` is true.

#### Scenario: Retrieve first page of recent photos
- **WHEN** `feedRecent(pageNumber: 0, batch)` is called without a search term
- **THEN** the system returns the most recent active photos in descending creation order, with `nextPage` set to `1`

#### Scenario: Recent feed paginates correctly
- **WHEN** `feedRecent` is called with `pageNumber > 0`
- **THEN** the correct offset is applied so no photos are repeated across pages, with `nextPage` set to `pageNumber + 1`

#### Scenario: Recent feed filtered by search term
- **WHEN** `feedRecent(pageNumber, batch, searchTerm)` is called with a non-null `searchTerm`
- **THEN** the system returns only active photos whose Recognitions metadata or Comments text match the search term via PostgreSQL full-text search, with `nextPage` set to `pageNumber + 1`

#### Scenario: No more recent results
- **WHEN** the returned photos count is less than the page size
- **THEN** `noMoreData` SHALL be true and `nextPage` SHALL be null

---

### Requirement: Full-text search feed
The system SHALL search photo recognitions and comments for a plain-English query term and return matching active photos. The query SHALL use parameterized SQL for the search term and pagination values. The controller SHALL use the shared search clause utility for the full-text search logic. The response SHALL include `nextPage` set to `pageNumber + 1` when results exist, or `null` when `noMoreData` is true.

#### Scenario: Search matches recognition labels
- **WHEN** `feedForTextSearch(searchTerm, pageNumber, batch)` is called
- **THEN** the system returns active photos whose Rekognition metadata contains the search term via PostgreSQL full-text search (`to_tsvector` / `plainto_tsquery`) using parameterized query for the search term, with `nextPage` set to `pageNumber + 1`

#### Scenario: Search matches comments
- **WHEN** `feedForTextSearch` is called with a term present in comments
- **THEN** photos whose active comments contain that term are included in the results

#### Scenario: No more search results
- **WHEN** the returned photos count is less than the page size
- **THEN** `noMoreData` SHALL be true and `nextPage` SHALL be null

---

### Requirement: Wave feed search
The system SHALL accept an optional `searchTerm` parameter (nullable, not required by GraphQL schema or controller signature) on the `feedForWave` query; when provided, results SHALL be filtered to only photos matching the full-text search. When `searchTerm` is omitted or null, behavior SHALL be identical to the pre-change implementation. The response SHALL include `nextPage` set to `pageNumber + 1` when results exist, or `null` when `noMoreData` is true.

#### Scenario: Wave feed without search term
- **WHEN** `feedForWave(waveUuid, pageNumber, batch)` is called without a search term
- **THEN** the system returns paginated active photos belonging to the wave in descending update order with `nextPage` set to `pageNumber + 1`

#### Scenario: Wave feed filtered by search term
- **WHEN** `feedForWave(waveUuid, pageNumber, batch, searchTerm)` is called with a non-null `searchTerm`
- **THEN** the system returns only wave photos whose Recognitions metadata or Comments text match the search term via PostgreSQL full-text search, with `nextPage` set to `pageNumber + 1`

#### Scenario: No more wave results
- **WHEN** the returned photos count is less than the page size
- **THEN** `noMoreData` SHALL be true and `nextPage` SHALL be null
