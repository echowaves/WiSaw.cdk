## Purpose
Define the wave listing capabilities: fetching waves with optional search, sort by name, and sort by recent photo activity.
## Requirements
### Requirement: listWaves accepts optional sort parameters
The `listWaves` GraphQL query SHALL accept two optional `String` parameters: `sortBy` and `sortDirection`. When omitted, `sortBy` SHALL default to `"updatedAt"` and `sortDirection` SHALL default to `"desc"`. The `recentPhoto` value is a valid sort field that orders waves by the most recent photo's `updatedAt` timestamp within that wave.

#### Scenario: Default sort (no params provided)
- **WHEN** `listWaves` is called without `sortBy` or `sortDirection`
- **THEN** waves are returned sorted by `updatedAt DESC` (current behavior)

#### Scenario: Sort by createdAt ascending
- **WHEN** `listWaves` is called with `sortBy: "createdAt"` and `sortDirection: "asc"`
- **THEN** waves are returned sorted by `createdAt ASC` (oldest first)

#### Scenario: Sort by createdAt descending
- **WHEN** `listWaves` is called with `sortBy: "createdAt"` and `sortDirection: "desc"`
- **THEN** waves are returned sorted by `createdAt DESC` (newest first)

#### Scenario: Sort by updatedAt ascending
- **WHEN** `listWaves` is called with `sortBy: "updatedAt"` and `sortDirection: "asc"`
- **THEN** waves are returned sorted by `updatedAt ASC` (least recently updated first)

### Requirement: Invalid sort values are rejected
The controller SHALL validate `sortBy` and `sortDirection` against a whitelist of allowed values. Invalid values SHALL cause an error to be thrown.

#### Scenario: Invalid sortBy value
- **WHEN** `listWaves` is called with `sortBy: "nonexistent"`
- **THEN** the system throws an error "Invalid sort field"

#### Scenario: Invalid sortDirection value
- **WHEN** `listWaves` is called with `sortDirection: "random"`
- **THEN** the system throws an error "Invalid sort direction"

### Requirement: Sort parameters are safe from SQL injection
The controller SHALL construct the ORDER BY clause using a whitelist lookup, never by interpolating user input directly into the SQL query.

#### Scenario: SQL injection attempt in sortBy
- **WHEN** `listWaves` is called with `sortBy: "updatedAt\"; DROP TABLE \"Waves\"--"`
- **THEN** the system throws an error "Invalid sort field" and no SQL injection occurs

### Requirement: List waves with optional search filter
The `listWaves` GraphQL query SHALL accept an optional `searchTerm` parameter. When provided, the query SHALL return only waves whose `name` or `description` contains the search term (case-insensitive substring match). When omitted, all of the user's waves SHALL be returned as before.

#### Scenario: Search by name
- **WHEN** `searchTerm` is "beach" and the user has waves named "Beach Party", "Mountain Hike", and "Beach Sunset"
- **THEN** the system SHALL return "Beach Party" and "Beach Sunset" only

#### Scenario: Search by description
- **WHEN** `searchTerm` is "summer" and a wave's description contains "Summer vacation photos"
- **THEN** the system SHALL include that wave in results

#### Scenario: Search is case-insensitive
- **WHEN** `searchTerm` is "BEACH"
- **THEN** the system SHALL match waves with name "beach party" or "Beach Sunset"

#### Scenario: No search term provided
- **WHEN** `searchTerm` is omitted or empty
- **THEN** the system SHALL return all of the user's waves (existing behavior unchanged)

#### Scenario: Search term uses parameterized query
- **WHEN** `searchTerm` is provided
- **THEN** the system SHALL use a parameterized query (`$N`) with the search value, not string interpolation

### Requirement: Sort waves by name
The `listWaves` query SHALL accept `name` as a valid value for the `sortBy` parameter, enabling alphabetical sorting of waves.

#### Scenario: Sort by name ascending
- **WHEN** `sortBy` is "name" and `sortDirection` is "asc"
- **THEN** waves SHALL be returned in alphabetical order by name

#### Scenario: Sort by name descending
- **WHEN** `sortBy` is "name" and `sortDirection` is "desc"
- **THEN** waves SHALL be returned in reverse alphabetical order by name

### Requirement: Sort waves by recent photo
The `listWaves` query SHALL accept `recentPhoto` as a valid value for the `sortBy` parameter, enabling sorting by the most recent photo's `updatedAt` timestamp within each wave.

#### Scenario: Sort by recent photo descending
- **WHEN** `sortBy` is "recentPhoto" and `sortDirection` is "desc"
- **THEN** waves SHALL be returned ordered by the most recent photo's `updatedAt` timestamp (newest photo first)

#### Scenario: Sort by recent photo ascending
- **WHEN** `sortBy` is "recentPhoto" and `sortDirection` is "asc"
- **THEN** waves SHALL be returned ordered by the most recent photo's `updatedAt` timestamp (oldest photo first)

#### Scenario: Wave with no photos sorts last
- **WHEN** `sortBy` is "recentPhoto" and some waves have no photos
- **THEN** waves without photos SHALL appear after waves with photos (NULLs last in DESC order per PostgreSQL default behavior)

