## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Chat and ChatUser creation on friendship initiation
**Reason**: Chat feature is abandoned. Chat/ChatUser records are no longer created when friendships are initiated.
**Migration**: No migration needed — clients must stop referencing CreateFriendshipResult, Chat, and ChatUser types.

### Requirement: ChatUser insertion on friendship acceptance
**Reason**: Chat feature is abandoned. ChatUser records are no longer created when friendships are accepted.
**Migration**: No migration needed — clients must stop referencing CreateFriendshipResult type.
