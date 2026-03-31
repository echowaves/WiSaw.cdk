### Requirement: Query returns count of active watched photos
The `getWatchedCount` GraphQL query SHALL accept a `uuid` (String!) parameter and return an `Int!` representing the number of active photos currently watched by that user.

#### Scenario: User watches several photos
- **WHEN** a user with uuid "abc-123" has 5 watcher records and all 5 referenced photos are active
- **THEN** `getWatchedCount(uuid: "abc-123")` returns `5`

#### Scenario: Some watched photos are inactive
- **WHEN** a user has 5 watcher records but 2 of the referenced photos have `active = false`
- **THEN** `getWatchedCount` returns `3` (only active photos counted)

#### Scenario: User watches no photos
- **WHEN** a user has no watcher records
- **THEN** `getWatchedCount` returns `0`

### Requirement: Input validation
The `getWatchedCount` query SHALL validate that `uuid` is a valid UUID format before executing the database query.

#### Scenario: Invalid uuid provided
- **WHEN** `getWatchedCount` is called with an invalid uuid (e.g., empty string or non-UUID format)
- **THEN** the query SHALL reject the request with a validation error
