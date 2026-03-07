## ADDED Requirements

### Requirement: Feed by date and location
The system SHALL return photos from a sliding date window centered on a location, ordered by creation time descending, with optional Wave filter.

#### Scenario: Retrieve feed for a given day
- **WHEN** `feedByDate(daysAgo, lat, lon, batch, whenToStop)` is called
- **THEN** the system returns up to 1000 active photos created within a 1-day window `daysAgo` days before now, each annotated with distance from the provided coordinates

#### Scenario: Feed filtered by Wave
- **WHEN** `feedByDate` is called with a non-null `waveUuid`
- **THEN** only photos that belong to that Wave (via `WavePhotos`) are included in the result

#### Scenario: No more data signal
- **WHEN** the returned photo list is empty or the oldest returned photo's `createdAt` is before `whenToStop`
- **THEN** `noMoreData` is set to `true`

---

### Requirement: Watcher feed
The system SHALL return a paginated feed of photos that a given device UUID is watching, ordered by most recently created first.

#### Scenario: Retrieve watcher feed page
- **WHEN** `feedForWatcher(uuid, pageNumber, batch)` is called
- **THEN** the system returns up to the configured page size of active photos watched by that UUID in descending creation order

#### Scenario: Watcher feed filtered by Wave
- **WHEN** `feedForWatcher` is called with a non-null `waveUuid`
- **THEN** only watched photos that also belong to the specified Wave are returned

---

### Requirement: Recent feed
The system SHALL return a paginated feed of the most recently uploaded active photos, globally, with optional Wave filter.

#### Scenario: Retrieve first page of recent photos
- **WHEN** `feedRecent(pageNumber: 0, batch)` is called
- **THEN** the system returns the most recent active photos in descending creation order

#### Scenario: Recent feed paginates correctly
- **WHEN** `feedRecent` is called with `pageNumber > 0`
- **THEN** the correct offset is applied so no photos are repeated across pages

---

### Requirement: Full-text search feed
The system SHALL search photo recognitions and comments for a plain-English query term and return matching active photos.

#### Scenario: Search matches recognition labels
- **WHEN** `feedForTextSearch(searchTerm, pageNumber, batch)` is called
- **THEN** the system returns active photos whose Rekognition metadata contains the search term via PostgreSQL full-text search (`to_tsvector` / `plainto_tsquery`)

#### Scenario: Search matches comments
- **WHEN** `feedForTextSearch` is called with a term present in comments
- **THEN** photos whose active comments contain that term are included in the results

#### Scenario: Text search filtered by Wave
- **WHEN** `feedForTextSearch` is called with a non-null `waveUuid`
- **THEN** only photos belonging to that Wave are searched

---

### Requirement: Feed pagination batch token
The system SHALL accept and echo back an opaque `batch` string that clients use to correlate paginated request sets.

#### Scenario: Batch token is echoed unchanged
- **WHEN** any feed query is called with an arbitrary `batch` string
- **THEN** the `PhotoFeed` response contains the same `batch` value passed in
