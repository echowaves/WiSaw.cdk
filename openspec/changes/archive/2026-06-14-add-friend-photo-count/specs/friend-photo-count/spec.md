## MODIFIED Requirements

### Requirement: Friendship type includes photo count
The `Friendship` GraphQL type SHALL include a `photosCount` field of type `Int` that represents the total number of photos owned by the friend associated with the friendship.

#### Scenario: Get friendships with photo counts
- **WHEN** the client queries `getFriendshipsList`
- **THEN** the response includes `photosCount` field for each friendship

#### Scenario: Photo count is zero when friend has no photos
- **WHEN** a friend owns zero waves or all waves have zero photos
- **THEN** `photosCount` returns `0`

#### Scenario: Photo count reflects all waves owned by the friend
- **WHEN** a friend owns multiple waves with photos
- **THEN** `photosCount` returns the sum of all photos across all waves owned by that friend

## ADDED Requirements

### Requirement: Photo count computation uses batch query
The resolver SHALL compute photo counts efficiently by batching wave lookups and photo count queries across all friends in a single `getFriendshipsList` call.

#### Scenario: Batch photo count computation
- **WHEN** `getFriendshipsList` is called with 50 friends
- **THEN** the resolver performs a bounded number of DynamoDB queries (not O(n) per-friend queries)

#### Scenario: Photo count returns null when computation fails
- **WHEN** a DynamoDB query for photo count fails
- **THEN** `photosCount` returns `null` and the error is logged server-side without failing the entire query