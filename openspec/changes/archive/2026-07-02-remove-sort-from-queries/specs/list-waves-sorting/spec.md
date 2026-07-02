## REMOVED Requirements

### Requirement: listWaves accepts optional sort parameters
**Reason**: Sort parameters are not used by the client. Removing them simplifies the API and eliminates dead code.
**Migration**: The query now always returns waves sorted by `createdAt DESC`. No client changes needed — the client never passed these parameters.

**Previous behavior**:
- `sortBy` defaulted to `"updatedAt"`, `sortDirection` defaulted to `"desc"`
- Valid `sortBy` values: `createdAt`, `updatedAt`, `name`, `recentPhoto`
- Valid `sortDirection` values: `asc`, `desc`

**New behavior**:
- No `sortBy` or `sortDirection` parameters
- Waves always ordered by `createdAt DESC`

#### Scenario: listWaves returns waves sorted by createdAt descending
- **WHEN** `listWaves` is called without any sort parameters
- **THEN** waves are returned sorted by `createdAt DESC`

---

### Requirement: Invalid sort values are rejected
**Reason**: Removed along with sort parameters — no sort params means no sort validation needed.
**Migration**: The controller no longer validates sort values.

#### Scenario: No sort validation needed
- **WHEN** `listWaves` is called without sort parameters
- **THEN** no sort validation errors can occur

---

### Requirement: Sort parameters are safe from SQL injection
**Reason**: Removed along with sort parameters — dynamic ORDER BY is no longer used.
**Migration**: The ORDER BY clause is now a static string.

#### Scenario: Static ORDER BY is safe
- **WHEN** `listWaves` is called without sort parameters
- **THEN** the ORDER BY clause uses a hardcoded `"createdAt"` — no user input is interpolated

---

### Requirement: Sort waves by name
**Reason**: Alphabetical sorting is not used by the client; text search is sufficient for finding waves.
**Migration**: Users can still find waves by name using the `searchTerm` parameter.

#### Scenario: Name sorting removed
- **WHEN** `listWaves` is called without sort parameters
- **THEN** waves are ordered by `createdAt DESC` only — name sorting is no longer available

---

### Requirement: Sort waves by recent photo
**Reason**: Not used by the client.
**Migration**: No migration needed — the feature was unused.

#### Scenario: Recent photo sorting removed
- **WHEN** `listWaves` is called without sort parameters
- **THEN** waves are ordered by `createdAt DESC` only — recent photo sorting is no longer available
