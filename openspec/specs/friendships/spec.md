## Purpose
Define the friendship management capabilities: creating, accepting, listing, and deleting friendships, including sorting by recent photo activity.
## Requirements
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

### Requirement: Delete a friendship
The system SHALL allow either party to delete a friendship record. All SQL queries SHALL use parameterized SQL.

#### Scenario: Friendship deleted
- **WHEN** `deleteFriendship(friendshipUuid)` is called
- **THEN** the Friendship record is removed and `"OK"` is returned

---

### Requirement: List friendships for a user
**MODIFIED:** The system SHALL filter out self-friendships from the results and deduplicate bidirectional friendships using DISTINCT ON.

The system SHALL return all confirmed friendships where a given device `uuid` is either `uuid1` or `uuid2`, including up to 5 recent active photos for each friend. All SQL queries SHALL use parameterized SQL. The controller SHALL validate the device `uuid` format. The controller SHALL accept optional `sortBy` and `sortDirection` parameters. When `sortBy` is `"recentPhoto"`, the system SHALL order friends by the most recent photo's `updatedAt` timestamp. The `recentPhoto` sort value is valid in addition to the existing default ordering.

**Query (default order, no sortBy):**
```sql
SELECT DISTINCT ON (LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2)) *
FROM "Friendships"
WHERE "uuid1" = $1 OR "uuid2" = $1
ORDER BY LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2), "createdAt" DESC
```

**Query (sortBy: "recentPhoto", sortDirection: "desc"):**
```sql
SELECT DISTINCT ON (LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2)) *,
       (SELECT MAX(p."updatedAt") FROM "Photos" p WHERE p."uuid" = friend_uuid) AS "lastPhotoAt"
FROM "Friendships"
WHERE "uuid1" = $1 OR "uuid2" = $1
ORDER BY lastPhotoAt DESC, "createdAt" DESC
```

#### Scenario: Friendships list returned
- **WHEN** `getFriendshipsList(uuid)` is called with a valid device `uuid`
- **THEN** all Friendship records where the UUID appears as `uuid1` or `uuid2` are returned, excluding any self-friendships where `uuid1 = uuid2`; records where `uuid2` is null represent unaccepted outgoing requests; each friendship includes a `photos` field with up to 5 recent active photos from the friend

#### Scenario: Bidirectional friendship deduplication
- **WHEN** `getFriendshipsList(uuid)` is called with bidirectional friendships `(uuid1=A, uuid2=B)` and `(uuid1=B, uuid2=A)`
- **THEN** exactly 1 entry for friend B is returned, using the most recent `createdAt` timestamp

#### Scenario: Self-friendship filtered
- **WHEN** `getFriendshipsList(uuid)` is called and there exists a self-friendship where `uuid1 = uuid2 = uuid`
- **THEN** the self-friendship is excluded from the returned list

#### Scenario: Invalid uuid rejected
- **WHEN** `getFriendshipsList` is called with an invalid `uuid` format
- **THEN** the system throws a validation error before executing any SQL query

#### Scenario: Sort by recent photo descending
- **WHEN** `getFriendshipsList(uuid, "recentPhoto", "desc")` is called
- **THEN** friends SHALL be returned ordered by the most recent photo's `updatedAt` timestamp (newest photo first)

#### Scenario: Sort by recent photo ascending
- **WHEN** `getFriendshipsList(uuid, "recentPhoto", "asc")` is called
- **THEN** friends SHALL be returned ordered by the most recent photo's `updatedAt` timestamp (oldest photo first)

#### Scenario: Friend with no photos sorts last
- **WHEN** `getFriendshipsList(uuid, "recentPhoto", "desc")` is called and some friends have no photos
- **THEN** friends without photos SHALL appear after friends with photos (NULLs last in DESC order per PostgreSQL default behavior)

#### Scenario: Invalid sortBy value rejected
- **WHEN** `getFriendshipsList(uuid, "nonexistent", "desc")` is called
- **THEN** the system throws an error "Invalid sort field"

#### Scenario: Invalid sortDirection value rejected
- **WHEN** `getFriendshipsList(uuid, "recentPhoto", "random")` is called
- **THEN** the system throws an error "Invalid sort direction"

#### Scenario: Sort by photo date is safe from SQL injection
- **WHEN** `getFriendshipsList(uuid, 'recentPhoto"; DROP TABLE "Photos"--', "desc")` is called
- **THEN** the system throws an error "Invalid sort field" and no SQL injection occurs

### Requirement: Fetch friend's photo feed
The system SHALL reject requests to fetch a photo feed for self.

#### Scenario: Self-feed rejected
- **WHEN** `feedForFriend(uuid, friendUuid)` is called where `uuid === friendUuid`
- **THEN** the system throws a validation error "Cannot fetch feed for self"

