## ADDED Requirements

### Requirement: Initiate a friendship request
The system SHALL allow a device (identified by its `uuid`) to initiate a friendship by creating a pending Friendship record. All SQL queries SHALL use parameterized SQL.

#### Scenario: Friendship request created
- **WHEN** `createFriendship(uuid)` is called with a valid UUID
- **THEN** a Friendship record is inserted with `uuid1` set to the initiator, `uuid2` as null (pending); the `Friendship` is returned

#### Scenario: UUID format validated
- **WHEN** `createFriendship` is called with an invalid UUID
- **THEN** the system throws a validation error and no records are created

---

### Requirement: Accept a friendship request
The system SHALL allow the recipient of a pending friendship to accept it by setting `uuid2`. All SQL queries SHALL use parameterized SQL.

#### Scenario: Friendship accepted
- **WHEN** `acceptFriendshipRequest(friendshipUuid, uuid)` is called with the UUID of the accepting party
- **THEN** the Friendship record is updated with `uuid2` set to the acceptor's UUID; the updated `Friendship` is returned

---

### Requirement: Delete a friendship
The system SHALL allow either party to delete a friendship record. All SQL queries SHALL use parameterized SQL.

#### Scenario: Friendship deleted
- **WHEN** `deleteFriendship(friendshipUuid)` is called
- **THEN** the Friendship record is removed and `"OK"` is returned

---

### Requirement: List friendships for a user
The system SHALL return all friendships (pending and confirmed) where a given device `uuid` is either `uuid1` or `uuid2`, including up to 5 recent active photos for each confirmed friend. All SQL queries SHALL use parameterized SQL. The controller SHALL validate the device `uuid` format.

#### Scenario: Friendships list returned
- **WHEN** `getFriendshipsList(uuid)` is called with a valid device `uuid`
- **THEN** all Friendship records where the UUID appears as `uuid1` or `uuid2` are returned; records where `uuid2` is null represent unaccepted outgoing requests; each friendship includes a `photos` field with up to 5 recent active photos from the friend

#### Scenario: Invalid uuid rejected
- **WHEN** `getFriendshipsList` is called with an invalid `uuid` format
- **THEN** the system throws a validation error before executing any SQL query
