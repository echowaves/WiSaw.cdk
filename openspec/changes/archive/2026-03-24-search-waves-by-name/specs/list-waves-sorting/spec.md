## MODIFIED Requirements

### Requirement: List waves with optional search filter
The `listWaves` query SHALL accept an optional `searchTerm` parameter. When provided, the query SHALL return only waves whose `name` or `description` contains the search term (case-insensitive substring match). When omitted, all of the user's waves SHALL be returned as before.

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
