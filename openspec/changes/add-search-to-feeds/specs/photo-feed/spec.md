## MODIFIED Requirements

### Requirement: Feed by date and location
The system SHALL return photos from a sliding date window centered on a location, ordered by creation time descending. The query SHALL use parameterized SQL for all interpolated values including coordinates, date boundaries, and pagination limits. The controller SHALL validate that `lat` and `lon` are finite numbers. The query SHALL accept an optional `searchTerm` parameter (nullable, not required by GraphQL schema or controller signature); when provided, results SHALL be filtered to only photos matching the full-text search. When `searchTerm` is omitted or null, behavior SHALL be identical to the pre-change implementation.

#### Scenario: Retrieve feed for a given day
- **WHEN** `feedByDate(daysAgo, lat, lon, batch, whenToStop)` is called without a search term
- **THEN** the system returns up to 1000 active photos created within a 1-day window `daysAgo` days before now, each annotated with distance from the provided coordinates

#### Scenario: No more data signal
- **WHEN** the returned photo list is empty or the oldest returned photo's `createdAt` is before `whenToStop`
- **THEN** `noMoreData` is set to `true`

#### Scenario: Feed by date filtered by search term
- **WHEN** `feedByDate(daysAgo, lat, lon, batch, whenToStop, searchTerm)` is called with a non-null `searchTerm`
- **THEN** the system returns only active photos within the date/location window whose Recognitions metadata or Comments text match the search term via PostgreSQL full-text search

---

### Requirement: Watcher feed
The system SHALL return a paginated feed of photos that a given device `uuid` is watching, ordered by most recently updated first. The controller SHALL validate the device `uuid` format before querying and SHALL use parameterized SQL for all values. The query SHALL accept an optional `searchTerm` parameter (nullable, not required by GraphQL schema or controller signature); when provided, results SHALL be filtered to only photos matching the full-text search. When `searchTerm` is omitted or null, behavior SHALL be identical to the pre-change implementation.

#### Scenario: Retrieve watcher feed page
- **WHEN** `feedForWatcher(uuid, pageNumber, batch)` is called with a valid device `uuid` and no search term
- **THEN** the system returns up to the configured page size of active photos watched by that device in descending update order

#### Scenario: Invalid device uuid rejected
- **WHEN** `feedForWatcher` is called with an invalid `uuid` format
- **THEN** the controller SHALL throw a validation error before executing any SQL query

#### Scenario: Watcher feed filtered by search term
- **WHEN** `feedForWatcher(uuid, pageNumber, batch, searchTerm)` is called with a non-null `searchTerm`
- **THEN** the system returns only watched photos whose Recognitions metadata or Comments text match the search term via PostgreSQL full-text search

---

### Requirement: Recent feed
The system SHALL return a paginated feed of the most recently uploaded active photos, globally. The query SHALL use parameterized SQL for pagination values. The query SHALL accept an optional `searchTerm` parameter (nullable, not required by GraphQL schema or controller signature); when provided, results SHALL be filtered to only photos matching the full-text search. When `searchTerm` is omitted or null, behavior SHALL be identical to the pre-change implementation.

#### Scenario: Retrieve first page of recent photos
- **WHEN** `feedRecent(pageNumber: 0, batch)` is called without a search term
- **THEN** the system returns the most recent active photos in descending creation order

#### Scenario: Recent feed paginates correctly
- **WHEN** `feedRecent` is called with `pageNumber > 0`
- **THEN** the correct offset is applied so no photos are repeated across pages

#### Scenario: Recent feed filtered by search term
- **WHEN** `feedRecent(pageNumber, batch, searchTerm)` is called with a non-null `searchTerm`
- **THEN** the system returns only active photos whose Recognitions metadata or Comments text match the search term via PostgreSQL full-text search

---

### Requirement: Full-text search feed
The system SHALL search photo recognitions and comments for a plain-English query term and return matching active photos. The query SHALL use parameterized SQL for the search term and pagination values. The controller SHALL use the shared search clause utility for the full-text search logic.

#### Scenario: Search matches recognition labels
- **WHEN** `feedForTextSearch(searchTerm, pageNumber, batch)` is called
- **THEN** the system returns active photos whose Rekognition metadata contains the search term via PostgreSQL full-text search (`to_tsvector` / `plainto_tsquery`) using parameterized query for the search term

#### Scenario: Search matches comments
- **WHEN** `feedForTextSearch` is called with a term present in comments
- **THEN** photos whose active comments contain that term are included in the results

---

## ADDED Requirements

### Requirement: Shared search clause utility
The system SHALL provide a reusable `buildSearchClause(searchTerm, paramStartIndex)` utility that returns a SQL WHERE clause fragment and corresponding parameter array for full-text search filtering on Recognitions metadata and Comments text.

#### Scenario: Search term provided
- **WHEN** `buildSearchClause` is called with a non-null search term and a param start index
- **THEN** it returns a clause `AND "id" IN (SELECT ... UNION ...)` using the given param index, and a params array containing the search term

#### Scenario: Search term is null
- **WHEN** `buildSearchClause` is called with null or undefined
- **THEN** it returns an empty clause string and an empty params array

---

### Requirement: Wave feed search
The system SHALL accept an optional `searchTerm` parameter (nullable, not required by GraphQL schema or controller signature) on the `feedForWave` query; when provided, results SHALL be filtered to only photos matching the full-text search. When `searchTerm` is omitted or null, behavior SHALL be identical to the pre-change implementation.

#### Scenario: Wave feed without search term
- **WHEN** `feedForWave(waveUuid, pageNumber, batch)` is called without a search term
- **THEN** the system returns paginated active photos belonging to the wave in descending update order (existing behavior unchanged)

#### Scenario: Wave feed filtered by search term
- **WHEN** `feedForWave(waveUuid, pageNumber, batch, searchTerm)` is called with a non-null `searchTerm`
- **THEN** the system returns only wave photos whose Recognitions metadata or Comments text match the search term via PostgreSQL full-text search
