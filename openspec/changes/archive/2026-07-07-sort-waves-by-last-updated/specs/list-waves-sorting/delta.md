## Delta: list-waves-sorting

### Requirement: listWaves returns waves sorted by updatedAt descending

**CHANGE:** The default sort order changes from `createdAt DESC` to `updatedAt DESC`.

The `listWaves` GraphQL query SHALL return waves sorted by `updatedAt DESC` (most recently updated first). No `sortBy` or `sortDirection` parameters are accepted.

#### Scenario: listWaves returns waves sorted by updatedAt descending

- **WHEN** `listWaves` is called without any sort parameters
- **THEN** waves are returned sorted by `updatedAt DESC`

#### Scenario: UpdatedAt reflects photo activity

- **WHEN** `listWaves` is called for a user who has both a newly-created empty wave and an older wave with recent photos
- **THEN** the wave with recent photos appears first in results
