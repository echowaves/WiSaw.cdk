## MODIFIED Requirements

### Requirement: Shared search clause utility
The system SHALL provide a reusable `buildSearchClause(searchTerm, paramStartIndex)` utility that returns a SQL WHERE clause fragment and corresponding parameter array for full-text search filtering on Recognitions metadata and Comments text. The clause SHALL use a table-qualified column reference (`p."id"`) so it works in queries with JOINs.

#### Scenario: Search term provided
- **WHEN** `buildSearchClause` is called with a non-null search term and a param start index
- **THEN** it returns a clause `AND p."id" IN (SELECT ... UNION ...)` using the given param index, and a params array containing the search term

#### Scenario: Search term is null
- **WHEN** `buildSearchClause` is called with null or undefined
- **THEN** it returns an empty clause string and an empty params array

#### Scenario: Search clause used in JOINed query
- **WHEN** the returned clause is used in a query that JOINs Photos with another table (e.g., Watchers, WavePhotos)
- **THEN** the column reference SHALL NOT be ambiguous — it SHALL resolve to the Photos table
