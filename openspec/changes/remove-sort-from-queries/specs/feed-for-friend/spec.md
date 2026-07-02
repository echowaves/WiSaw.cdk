## REMOVED Requirements

### Requirement: Configurable sorting for feedForFriend
**Reason**: Sort parameters are not used by the client. Removing them simplifies the API and eliminates dead code.
**Migration**: The query now always returns photos ordered by `updatedAt DESC`. No client changes needed — the client never passed these parameters.

**Previous behavior**:
- `sortBy` supported `createdAt`, `updatedAt` (default: `updatedAt`)
- `sortDirection` supported `asc`/`desc` (default: `desc`)

**New behavior**:
- No `sortBy` or `sortDirection` parameters
- Photos always ordered by `updatedAt DESC`

#### Scenario: Friend photo feed returns photos sorted by updatedAt descending
- **WHEN** `feedForFriend(uuid, friendUuid, pageNumber, batch)` is called without sort parameters
- **THEN** the system returns up to 100 active photos belonging to that friend, ordered by `updatedAt DESC`

#### Scenario: Sort parameters removed
- **WHEN** `feedForFriend` is called without sort parameters
- **THEN** no sort validation errors can occur and photos are ordered by `updatedAt DESC`
