### Requirement: Preview photos in friendships list
The `getFriendshipsList` query SHALL return up to 5 recent active photos for each confirmed friend, attached as a `photos` field on the Friendship type.

#### Scenario: Friend has photos
- **WHEN** `getFriendshipsList(uuid)` is called and a confirmed friend has 10 active photos
- **THEN** the friendship record includes the 5 most recently updated active photos in the `photos` field

#### Scenario: Friend has fewer than 5 photos
- **WHEN** a confirmed friend has 3 active photos
- **THEN** all 3 photos are returned in the `photos` field

#### Scenario: Friend has no photos
- **WHEN** a confirmed friend has no active photos
- **THEN** the `photos` field is an empty array

#### Scenario: Pending friendship has no photos
- **WHEN** a friendship has `uuid2 = null` (pending)
- **THEN** the `photos` field is an empty array (no friend UUID to load photos for)

### Requirement: Batch loading efficiency
The system SHALL load preview photos in a single batch query for all friends, not one query per friend.

#### Scenario: Multiple friends loaded efficiently
- **WHEN** `getFriendshipsList` returns 10 confirmed friendships
- **THEN** all preview photos are loaded via a single SQL query using `ANY($1)` with the array of friend UUIDs
