## REMOVED Requirements

### Requirement: List friendships for a user — sort parameters
**Reason**: Sort parameters (`sortBy`, `sortDirection`) are not used by the client. Removing them simplifies the API and eliminates dead code.
**Migration**: The query now always returns friendships ordered by `createdAt DESC`. No client changes needed — the client never passed these parameters.

**Previous behavior**:
- `sortBy` supported `"recentPhoto"` (default: no sort beyond group dedup)
- `sortDirection` supported `asc`/`desc` (default: `desc`)

**New behavior**:
- No `sortBy` or `sortDirection` parameters
- Friendships always ordered by `createdAt DESC`

#### Scenario: Friendships list returned with default sort
- **WHEN** `getFriendshipsList(uuid)` is called with a valid device `uuid`
- **THEN** all Friendship records where the UUID appears are returned, ordered by `createdAt DESC`, with up to 5 recent active photos per friend

#### Scenario: Sort parameters removed
- **WHEN** `getFriendshipsList` is called without sort parameters
- **THEN** no sort validation errors can occur and friends are ordered by `createdAt DESC`
