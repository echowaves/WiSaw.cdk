## Purpose
Define the wave listing capabilities: fetching waves with optional search and default sorting by createdAt.
## Requirements
### Requirement: listWaves returns waves sorted by createdAt descending
The `listWaves` GraphQL query SHALL return waves sorted by `createdAt DESC` (newest first). No `sortBy` or `sortDirection` parameters are accepted.

#### Scenario: listWaves returns waves sorted by createdAt descending
- **WHEN** `listWaves` is called without any sort parameters
- **THEN** waves are returned sorted by `createdAt DESC`

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

