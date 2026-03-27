## MODIFIED Requirements

### Requirement: Feed by date and location
The system SHALL return photos from a sliding date window centered on a location, ordered by creation time descending. The query SHALL use parameterized SQL for all interpolated values including coordinates, date boundaries, and pagination limits. The controller SHALL validate that `lat` and `lon` are finite numbers.

#### Scenario: Retrieve feed for a given day
- **WHEN** `feedByDate(daysAgo, lat, lon, batch, whenToStop)` is called
- **THEN** the system returns up to 1000 active photos created within a 1-day window `daysAgo` days before now, each annotated with distance from the provided coordinates

#### Scenario: No more data signal
- **WHEN** the returned photo list is empty or the oldest returned photo's `createdAt` is before `whenToStop`
- **THEN** `noMoreData` is set to `true`

---

### Requirement: Watcher feed
The system SHALL return a paginated feed of photos that a given device `uuid` is watching, ordered by most recently updated first. The controller SHALL validate the device `uuid` format before querying and SHALL use parameterized SQL for all values.

#### Scenario: Retrieve watcher feed page
- **WHEN** `feedForWatcher(uuid, pageNumber, batch)` is called with a valid device `uuid`
- **THEN** the system returns up to the configured page size of active photos watched by that device in descending update order

#### Scenario: Invalid device uuid rejected
- **WHEN** `feedForWatcher` is called with an invalid `uuid` format
- **THEN** the controller SHALL throw a validation error before executing any SQL query

---

### Requirement: Recent feed
The system SHALL return a paginated feed of the most recently uploaded active photos, globally. The query SHALL use parameterized SQL for pagination values.

#### Scenario: Retrieve first page of recent photos
- **WHEN** `feedRecent(pageNumber: 0, batch)` is called
- **THEN** the system returns the most recent active photos in descending creation order

#### Scenario: Recent feed paginates correctly
- **WHEN** `feedRecent` is called with `pageNumber > 0`
- **THEN** the correct offset is applied so no photos are repeated across pages

---

### Requirement: Full-text search feed
The system SHALL search photo recognitions and comments for a plain-English query term and return matching active photos. The query SHALL use parameterized SQL for the search term and pagination values.

#### Scenario: Search matches recognition labels
- **WHEN** `feedForTextSearch(searchTerm, pageNumber, batch)` is called
- **THEN** the system returns active photos whose Rekognition metadata contains the search term via PostgreSQL full-text search (`to_tsvector` / `plainto_tsquery`) using parameterized query for the search term

#### Scenario: Search matches comments
- **WHEN** `feedForTextSearch` is called with a term present in comments
- **THEN** photos whose active comments contain that term are included in the results
