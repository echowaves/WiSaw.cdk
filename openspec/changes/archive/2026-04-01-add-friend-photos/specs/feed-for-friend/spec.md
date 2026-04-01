## ADDED Requirements

### Requirement: Paginated photo feed for a friend
The system SHALL provide a `feedForFriend` GraphQL query that returns a paginated feed of active photos belonging to a specific friend, identified by `friendUuid`.

#### Scenario: Retrieve first page of friend's photos
- **WHEN** `feedForFriend(uuid, friendUuid, pageNumber: 0, batch)` is called with valid UUIDs and an accepted friendship exists
- **THEN** the system returns up to 100 active photos where `Photos.uuid = friendUuid`, ordered by `updatedAt` descending by default, with `row_number` annotations

#### Scenario: Pagination works correctly
- **WHEN** `feedForFriend` is called with `pageNumber > 0`
- **THEN** the correct offset (`pageNumber * 100`) is applied and `row_number` values continue from the previous page's offset

#### Scenario: No more data signal
- **WHEN** fewer than 100 photos are returned for the requested page
- **THEN** `noMoreData` is set to `true` and `nextPage` is `null`

### Requirement: Friendship validation before access
The system SHALL validate that an accepted friendship exists between `uuid` and `friendUuid` before returning any photos. A friendship is accepted when `uuid2` is not null.

#### Scenario: No friendship exists
- **WHEN** `feedForFriend` is called with a `uuid` and `friendUuid` that have no friendship record
- **THEN** the system SHALL throw an error indicating no friendship exists

#### Scenario: Pending friendship
- **WHEN** `feedForFriend` is called with a `uuid` and `friendUuid` that have a pending friendship (`uuid2` is null)
- **THEN** the system SHALL throw an error indicating the friendship is not accepted

#### Scenario: Accepted friendship in either direction
- **WHEN** `feedForFriend` is called and the friendship exists as `(uuid1=uuid, uuid2=friendUuid)` OR `(uuid1=friendUuid, uuid2=uuid)`
- **THEN** the system SHALL allow access regardless of which side initiated

### Requirement: Search support
The system SHALL support optional text search on the friend's photos, using the same search mechanism as other photo feeds (recognitions and comments full-text search).

#### Scenario: Search term filters results
- **WHEN** `feedForFriend` is called with a `searchTerm`
- **THEN** only photos matching the search term (via recognitions or comments) are returned

### Requirement: Configurable sorting
The system SHALL support optional `sortBy` and `sortDirection` parameters.

#### Scenario: Sort by createdAt ascending
- **WHEN** `feedForFriend` is called with `sortBy: "createdAt"` and `sortDirection: "asc"`
- **THEN** photos are returned ordered by `createdAt ASC`

#### Scenario: Default sorting
- **WHEN** `feedForFriend` is called without `sortBy` or `sortDirection`
- **THEN** photos are returned ordered by `updatedAt DESC`

#### Scenario: Invalid sort field rejected
- **WHEN** `feedForFriend` is called with a `sortBy` value other than `createdAt` or `updatedAt`
- **THEN** the system SHALL throw an error

### Requirement: Input validation
The system SHALL validate that both `uuid` and `friendUuid` are valid UUID format.

#### Scenario: Invalid uuid rejected
- **WHEN** `feedForFriend` is called with an invalid `uuid` or `friendUuid`
- **THEN** the system SHALL throw a validation error
