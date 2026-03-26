## ADDED Requirements

### Requirement: listWaves query does not use DISTINCT
The `listWaves` SQL query SHALL NOT use `SELECT DISTINCT`. The `WaveUsers` composite primary key `(waveUuid, uuid)` guarantees that the JOIN produces at most one row per wave per user, making deduplication unnecessary.

#### Scenario: Query without DISTINCT returns same results
- **WHEN** `listWaves` is called for a user who is a member of multiple waves
- **THEN** the query SHALL return exactly one row per wave without using `DISTINCT`, relying on the `WaveUsers` PK constraint for uniqueness

### Requirement: Waves.updatedAt column is indexed
The `Waves` table SHALL have a B-tree index on the `updatedAt` column to support efficient sorting by the default sort field.

#### Scenario: Index exists on updatedAt
- **WHEN** the database schema is inspected
- **THEN** a B-tree index named `idx_Waves_updatedAt` SHALL exist on `Waves.updatedAt`

### Requirement: WaveUsers has a covering composite index for uuid lookups
The `WaveUsers` table SHALL have a composite B-tree index on `(uuid, waveUuid)` to enable index-only scans when filtering by `uuid` and joining on `waveUuid`.

#### Scenario: Composite index exists
- **WHEN** the database schema is inspected
- **THEN** a B-tree index named `idx_WaveUsers_uuid_waveUuid` SHALL exist on `WaveUsers(uuid, waveUuid)`
