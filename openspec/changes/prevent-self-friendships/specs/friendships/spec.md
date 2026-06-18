## MODIFIED Requirements

### Requirement: Initiate a friendship request
**MODIFIED:** The system SHALL reject attempts to create a friendship with self.

The system SHALL allow a device (identified by its `uuid`) to initiate a friendship by creating a pending Friendship record. All SQL queries SHALL use parameterized SQL.

#### Scenario: Friendship request created
- **WHEN** `createFriendship(uuid)` is called with a valid UUID
- **THEN** a Friendship record is inserted with `uuid1` set to the initiator, `uuid2` as null (pending); the `Friendship` is returned

#### Scenario: Self-friendship rejected
- **WHEN** `createFriendship(uuid)` is called where `uuid` is used to create a friendship with itself
- **THEN** the system throws a validation error and no records are created

#### Scenario: UUID format validated
- **WHEN** `createFriendship` is called with an invalid UUID
- **THEN** the system throws a validation error and no records are created

---

### Requirement: Accept a friendship request
**MODIFIED:** The system SHALL reject attempts to accept a friendship with self.

The system SHALL allow the recipient of a pending friendship to accept it by setting `uuid2`. All SQL queries SHALL use parameterized SQL.

#### Scenario: Friendship accepted
- **WHEN** `acceptFriendshipRequest(friendshipUuid, uuid)` is called with the UUID of the accepting party
- **THEN** the Friendship record is updated with `uuid2` set to the acceptor's UUID; the updated `Friendship` is returned

#### Scenario: Self-friendship acceptance rejected
- **WHEN** `acceptFriendshipRequest(friendshipUuid, uuid)` is called where `uuid1` of the friendship equals `uuid`
- **THEN** the system throws a validation error and the friendship is not updated

#### Scenario: UUID format validated
- **WHEN** `acceptFriendshipRequest` is called with an invalid UUID
- **THEN** the system throws a validation error and no records are updated

---

### Requirement: List friendships for a user
**MODIFIED:** The system SHALL filter out self-friendships from the results.

The system SHALL return all friendships (pending and confirmed) where a given device `uuid` is either `uuid1` or `uuid2`, including up to 5 recent active photos for each confirmed friend. All SQL queries SHALL use parameterized SQL. The controller SHALL validate the device `uuid` format.

#### Scenario: Friendships list returned
- **WHEN** `getFriendshipsList(uuid)` is called with a valid device `uuid`
- **THEN** all Friendship records where the UUID appears as `uuid1` or `uuid2` are returned, excluding any self-friendships where `uuid1 = uuid2`; records where `uuid2` is null represent unaccepted outgoing requests; each friendship includes a `photos` field with up to 5 recent active photos from the friend

#### Scenario: Self-friendship filtered
- **WHEN** `getFriendshipsList(uuid)` is called and there exists a self-friendship where `uuid1 = uuid2 = uuid`
- **THEN** the self-friendship is excluded from the returned list

#### Scenario: Invalid uuid rejected
- **WHEN** `getFriendshipsList` is called with an invalid `uuid` format
- **THEN** the system throws a validation error before executing any SQL query

---

## ADDED Requirements

### Requirement: Fetch friend's photo feed
The system SHALL reject requests to fetch a photo feed for self.

#### Scenario: Self-feed rejected
- **WHEN** `feedForFriend(uuid, friendUuid)` is called where `uuid === friendUuid`
- **THEN** the system throws a validation error "Cannot fetch feed for self"
