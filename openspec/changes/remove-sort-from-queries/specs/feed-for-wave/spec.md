## REMOVED Requirements

### Requirement: Configurable sorting for feedForWave
**Reason**: Sort parameters are not used by the client. Removing them simplifies the API and eliminates dead code.
**Migration**: The query now always returns photos ordered by `updatedAt DESC`. No client changes needed — the client never passed these parameters.

**Previous behavior**:
- `sortBy` supported `createdAt`, `updatedAt` (default: `updatedAt`)
- `sortDirection` supported `asc`/`desc` (default: `desc`)

**New behavior**:
- No `sortBy` or `sortDirection` parameters
- Photos always ordered by `updatedAt DESC`

#### Scenario: Wave photo feed returns photos sorted by updatedAt descending
- **WHEN** `feedForWave(waveUuid, pageNumber, batch)` is called without sort parameters
- **THEN** the system returns up to 100 active photos belonging to that wave, ordered by `updatedAt DESC`

#### Scenario: Sort parameters removed
- **WHEN** `feedForWave` is called without sort parameters
- **THEN** no sort validation errors can occur and photos are ordered by `updatedAt DESC`
