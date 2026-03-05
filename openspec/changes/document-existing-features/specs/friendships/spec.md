## ADDED Requirements

### Requirement: Initiate a friendship request
The system SHALL allow a device UUID to initiate a friendship by creating a pending Friendship record along with a dedicated Chat and ChatUser entry.

#### Scenario: Friendship request created
- **WHEN** `createFriendship(uuid)` is called with a valid UUID
- **THEN** a Friendship record is inserted with `uuid1` set to the initiator, `uuid2` as null (pending), and a new Chat + ChatUser row are created in the same transaction; the `CreateFriendshipResult` is returned

#### Scenario: UUID format validated
- **WHEN** `createFriendship` is called with an invalid UUID
- **THEN** the system throws a validation error and no records are created

---

### Requirement: Accept a friendship request
The system SHALL allow the recipient of a pending friendship to accept it, setting `uuid2` and adding them as a ChatUser.

#### Scenario: Friendship accepted
- **WHEN** `acceptFriendshipRequest(friendshipUuid, uuid)` is called with the UUID of the accepting party
- **THEN** the Friendship record is updated with `uuid2` set to the acceptor's UUID and a ChatUser record is added for the acceptor on the shared Chat; the updated `CreateFriendshipResult` is returned

---

### Requirement: Delete a friendship
The system SHALL allow either party to delete a friendship record.

#### Scenario: Friendship deleted
- **WHEN** `deleteFriendship(friendshipUuid)` is called
- **THEN** the Friendship record is removed and `"OK"` is returned

---

### Requirement: List friendships for a user
The system SHALL return all friendships (pending and confirmed) where a given UUID is either `uuid1` or `uuid2`.

#### Scenario: Friendships list returned
- **WHEN** `getFriendshipsList(uuid)` is called
- **THEN** all Friendship records where the UUID appears as `uuid1` or `uuid2` are returned; records where `uuid2` is null represent unaccepted outgoing requests
