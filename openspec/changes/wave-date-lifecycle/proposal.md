## Why

The wave freeze/active lifecycle is currently split across two independent mechanisms: a manual `frozen` boolean flag and time-based `startDate`/`endDate` fields. This duplication creates ambiguity (a wave can be unfrozen but past its end date, or frozen but with no end date), complicates controller logic with dual checks, and exposes an unnecessary `isActive` computed field that is just the inverse of `isFrozen`. Consolidating into a single date-driven model simplifies the data layer, eliminates redundant state, and makes wave lifecycle fully derivable from two dates.

## What Changes

- **BREAKING**: Rename `startDate` → `splashDate` and `endDate` → `freezeDate` in the database, GraphQL schema, and all application code
- **BREAKING**: Drop the `frozen` boolean column from the `Waves` table — frozen status is now derived purely from `freezeDate < NOW()`
- **BREAKING**: Remove `isActive` from the GraphQL `Wave` type and all controllers — active is simply `!isFrozen` (i.e. `splashDate <= NOW() AND freezeDate > NOW()`)
- **BREAKING**: Remove the `frozen` parameter from `updateWave` mutation — to freeze a wave, set `freezeDate` to a past date; to unfreeze, set it to a future date
- Add a data migration to backfill `splashDate` and `freezeDate` for all existing waves:
  - Waves with photos: `splashDate` = oldest photo date, `freezeDate` = newest photo date (keeps auto-grouped waves frozen)
  - Waves without photos: `splashDate` = `createdAt`, `freezeDate` = `createdAt + 1 month`
  - Existing explicit `startDate`/`endDate` values are preserved when present
  - Waves with `frozen=true` get `freezeDate` set to newest photo date (or `createdAt` if no photos), ensuring they remain frozen
- After backfill, add `NOT NULL` constraints to both `splashDate` and `freezeDate`
- Make `splashDate` and `freezeDate` optional parameters on `createWave` mutation with defaults: `splashDate = NOW()`, `freezeDate = NOW() + 30 days`
- Update `autoGroupPhotosIntoWaves` to set `splashDate` = oldest photo date, `freezeDate` = newest photo date (instead of `frozen = true`)
- Update `_isWaveFrozen` to derive freeze status from `splashDate` and `freezeDate` only: `NOW() < splashDate OR NOW() > freezeDate`
- Delete `_isWaveActive` helper entirely
- Update all SQL queries referencing `frozen`, `startDate`, or `endDate` column names

## Capabilities

### New Capabilities

_None — this change refactors existing capabilities rather than introducing new ones._

### Modified Capabilities

- `waves`: Rename scheduling fields, drop `frozen` column, remove `isActive`, change freeze/unfreeze semantics to be date-driven, add default dates on create
- `auto-group-photos`: Replace `frozen = true` with date-derived freeze (`freezeDate` = newest photo date)

## Impact

- **Database**: Migration renames 2 columns, drops 1 column, adds NOT NULL constraints. Backfills all existing rows.
- **GraphQL API**: Breaking changes to `Wave` type (field renames + removals) and `updateWave` mutation (param renames + removal). Mobile client must be updated.
- **Controllers**: 8+ controller files updated for column renames and logic changes. `_isWaveActive.ts` deleted.
- **Specs**: `waves` and `auto-group-photos` specs need requirement updates to reflect new field names and semantics.
