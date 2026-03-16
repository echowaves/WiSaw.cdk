## ADDED Requirements

### Requirement: Wave photo feed
The system SHALL provide a dedicated paginated feed query `feedForWave` that returns active photos belonging to a specific wave, ordered by most recently updated first.

#### Scenario: Retrieve first page of wave photos
- **WHEN** `feedForWave(waveUuid, pageNumber: 0, batch)` is called with a valid `waveUuid`
- **THEN** the system returns up to 100 active photos belonging to that wave via the `WavePhotos` association, ordered by `updatedAt` descending, each annotated with a `row_number`

#### Scenario: Wave feed paginates correctly
- **WHEN** `feedForWave` is called with `pageNumber > 0`
- **THEN** the correct offset (`pageNumber * 100`) is applied so no photos are repeated across pages, and `row_number` values continue from the previous page's offset

#### Scenario: No more data signal
- **WHEN** fewer than 100 photos are returned for the requested page
- **THEN** `noMoreData` is set to `true`

#### Scenario: Invalid waveUuid format
- **WHEN** `feedForWave` is called with a `waveUuid` that is not a valid UUID
- **THEN** the system SHALL throw an error indicating wrong UUID format

#### Scenario: Batch token echoed
- **WHEN** `feedForWave` is called with an arbitrary `batch` string
- **THEN** the response contains the same `batch` value passed in
