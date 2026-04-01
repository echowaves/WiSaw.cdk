## MODIFIED Requirements

### Requirement: List friendships for a user
The system SHALL return all friendships (pending and confirmed) where a given device `uuid` is either `uuid1` or `uuid2`, including up to 5 recent active photos for each confirmed friend. All SQL queries SHALL use parameterized SQL. The controller SHALL validate the device `uuid` format.

#### Scenario: Friendships list returned
- **WHEN** `getFriendshipsList(uuid)` is called with a valid device `uuid`
- **THEN** all Friendship records where the UUID appears as `uuid1` or `uuid2` are returned; records where `uuid2` is null represent unaccepted outgoing requests; each friendship includes a `photos` field with up to 5 recent active photos from the friend

#### Scenario: Invalid uuid rejected
- **WHEN** `getFriendshipsList` is called with an invalid `uuid` format
- **THEN** the system throws a validation error before executing any SQL query
