## ADDED Requirements

### Requirement: Concurrent execution guard

The `autoGroupPhotosIntoWaves` mutation SHALL acquire a PostgreSQL advisory lock scoped to the user UUID before processing. If the lock cannot be acquired (another invocation is already running for the same user), the mutation SHALL return early with `photosGrouped: 0`, `hasMore: true`, and no other side effects.

The lock SHALL be acquired using `pg_try_advisory_lock(hashtext('autoGroup:' || uuid))` and released using `pg_advisory_unlock` before closing the database connection.

#### Scenario: Concurrent call returns early

- **GIVEN** an `autoGroupPhotosIntoWaves` call is in progress for user U
- **WHEN** a second call for user U is invoked concurrently
- **THEN** the second call returns `{ photosGrouped: 0, photosRemaining: -1, hasMore: true, wavesCreated: 0, isNewWave: false, waveUuid: null, name: null }`
- **AND** no waves or WavePhotos are created by the second call

#### Scenario: Lock released after processing

- **GIVEN** `autoGroupPhotosIntoWaves` acquires the advisory lock
- **WHEN** processing completes (normally or via error)
- **THEN** the advisory lock is released before the database connection is cleaned up

#### Scenario: Lock released on Lambda crash

- **GIVEN** `autoGroupPhotosIntoWaves` acquires the advisory lock
- **WHEN** the Lambda invocation crashes or times out
- **THEN** the database connection is closed by `serverless-postgres`
- **AND** the advisory lock is automatically released by PostgreSQL

#### Scenario: Different users not blocked

- **GIVEN** `autoGroupPhotosIntoWaves` is running for user A
- **WHEN** a call for user B is invoked
- **THEN** user B's call proceeds normally (different lock key)

## MODIFIED Requirements

### Requirement: Anchor fields updated during processing

When the dominant locality changes during wave processing (e.g., more photos arrive with a different locality than the anchor), the anchor fields (`anchorLocality`, `anchorDistrict`, `anchorRegion`, `anchorCountry`) SHALL NOT be updated. Only the wave `name` SHALL be updated to reflect the most-frequent locality. Anchor fields are stable identity fields used for wave matching and SHALL remain as set at wave creation time.

#### Scenario: Anchor fields unchanged during refinement

- **WHEN** a wave anchored on "Potsdam" receives 5 subsequent photos from "Berlin-Mitte"
- **THEN** `anchorLocality` remains "Potsdam"
- **AND** the wave `name` is updated to reflect "Berlin-Mitte" (the most-frequent locality)

#### Scenario: Null-locality wave retains original anchors

- **GIVEN** a wave created with `anchorCountry = "Antarctica"` and `anchorRegion = NULL`
- **WHEN** 277 photos are processed, all with null locality
- **THEN** `anchorCountry` remains "Antarctica"
- **AND** `anchorRegion` remains NULL
- **AND** subsequent batches can still match the wave via `anchorCountry = 'Antarctica'`
