## ADDED Requirements

### Requirement: Ungrouped photos feed
The system SHALL return a paginated feed of a device's active photos that are not assigned to any wave, ordered by most recently updated first. The controller SHALL validate the device `uuid` format before querying and SHALL use parameterized SQL for all values. The query SHALL accept an optional `searchTerm` parameter; when provided, results SHALL be filtered to only photos matching the full-text search. When `searchTerm` is omitted or null, all ungrouped photos for the device SHALL be returned. The response SHALL include `nextPage` set to `pageNumber + 1` when results exist, or `null` when `noMoreData` is true.

#### Scenario: Retrieve first page of ungrouped photos
- **WHEN** `feedForUngrouped(uuid, pageNumber: 0, batch)` is called with a valid device UUID and no search term
- **THEN** the system SHALL return up to 100 active photos belonging to that device that are not in any wave, ordered by `updatedAt` descending, with `nextPage` set to `1`

#### Scenario: Paginate through ungrouped photos
- **WHEN** `feedForUngrouped(uuid, pageNumber, batch)` is called with `pageNumber > 0`
- **THEN** the correct offset SHALL be applied so no photos are repeated across pages, with `nextPage` set to `pageNumber + 1`

#### Scenario: No more ungrouped results
- **WHEN** the returned photos count is less than the page size (100)
- **THEN** `noMoreData` SHALL be true and `nextPage` SHALL be null

#### Scenario: Invalid device UUID rejected
- **WHEN** `feedForUngrouped` is called with an invalid `uuid` format
- **THEN** the controller SHALL throw a validation error before executing any SQL query

#### Scenario: Ungrouped feed filtered by search term
- **WHEN** `feedForUngrouped(uuid, pageNumber, batch, searchTerm)` is called with a non-null `searchTerm`
- **THEN** the system SHALL return only ungrouped photos whose Recognitions searchable text or Comments text match the search term via PostgreSQL full-text search

#### Scenario: Photo assigned to a wave is excluded
- **WHEN** a photo belongs to at least one wave via the WavePhotos table
- **THEN** that photo SHALL NOT appear in the ungrouped feed

#### Scenario: Batch token echoed
- **WHEN** `feedForUngrouped` is called with a `batch` string
- **THEN** the response SHALL contain the same `batch` value
