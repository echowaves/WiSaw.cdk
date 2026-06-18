## ADDED Requirements

### Requirement: Shared paginatedPhotos utility
A shared utility `fetchPaginatedPhotos` handles `psql.connect/clean`, query execution, `plainToClass` mapping, and `noMoreData`/`nextPage` computation for all offset-based photo feeds.

#### Scenario: Utility executes query and maps results
- **WHEN** `fetchPaginatedPhotos({ query, params, pageNumber, batchSize })` is called
- **THEN** utility connects to database, executes query, maps rows to Photo instances, and cleans up connection

#### Scenario: Utility computes pagination state
- **WHEN** utility receives results
- **THEN** `noMoreData` is true when `photos.length < batchSize`, `nextPage` is `pageNumber + 1` when `noMoreData` is false

#### Scenario: Utility handles errors with connection cleanup
- **WHEN** query execution throws an error
- **THEN** `psql.clean()` is called in a finally block to ensure connection is released

### Requirement: Dead row_number SQL removed from feeds
All offset-based photo feeds no longer include `row_number() OVER (...)` in their SQL queries.

#### Scenario: Photos returned without row_number computation
- **WHEN** any offset-based feed is called
- **THEN** the SQL query does not include `row_number()` window function
