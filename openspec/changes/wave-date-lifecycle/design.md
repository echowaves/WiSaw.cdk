## Context

Waves currently have three fields governing their lifecycle: `frozen` (boolean), `startDate` (nullable DATE), and `endDate` (nullable DATE). The application computes two derived fields: `isFrozen` (true if `frozen=true` OR `endDate` has passed) and `isActive` (true if not frozen AND `startDate` has passed or is null). This dual mechanism means a wave can be frozen via a boolean flag independently of its dates, creating redundant state and extra branching in every controller that checks freeze status.

The `frozen` column was originally introduced for auto-grouped waves (set to `true` on creation). The `startDate`/`endDate` columns were added later for scheduling. Both serve the same purpose: controlling when a wave accepts contributions.

## Goals / Non-Goals

**Goals:**
- Single source of truth for wave lifecycle: `splashDate` and `freezeDate` columns only
- Frozen status derived purely from dates: `NOW() < splashDate OR NOW() > freezeDate`
- Clean migration of all existing data with no loss of intent (frozen waves stay frozen, scheduled waves keep their dates)
- Remove `isActive` from the API — it's redundant with `!isFrozen`
- Default dates on wave creation: `splashDate = NOW()`, `freezeDate = NOW() + 30 days`

**Non-Goals:**
- Changing how geo-boundaries work
- Modifying wave membership/roles
- Adding new wave features (this is purely a refactor of the lifecycle model)
- Changing the `open` boolean field

## Decisions

### 1. Frozen = date-derived only, drop the boolean

**Decision**: Remove the `frozen` column entirely. A wave is frozen when `NOW() > freezeDate` or `NOW() < splashDate`.

**Rationale**: The boolean was only ever set in two places — `autoGroupPhotosIntoWaves` (always `true`) and `updateWave` (manual toggle). Both use cases are covered by setting `freezeDate` to a past date. Eliminating the boolean removes an entire class of state inconsistency.

**Alternative considered**: Keep `frozen` as a "permanent lock" override. Rejected because the same effect is achieved by setting `freezeDate` far in the past, and the dual mechanism is the root of the complexity we're eliminating.

### 2. Column renames: `startDate` → `splashDate`, `endDate` → `freezeDate`

**Decision**: Use PostgreSQL `ALTER TABLE ... RENAME COLUMN` for zero-copy renames.

**Rationale**: Column renames in PostgreSQL are metadata-only operations — no data rewrite, no table lock beyond AccessExclusiveLock for a brief moment. This is safe for production with existing data.

### 3. Migration order: backfill → rename → constrain → drop

**Decision**: Single migration file with ordered steps:
1. Backfill NULL `startDate` and `endDate` values using photo dates or wave `createdAt`
2. Handle `frozen=true` waves by ensuring their `endDate` is in the past
3. Rename columns
4. Add NOT NULL constraints
5. Drop `frozen` column

**Rationale**: All steps must happen atomically. If backfill happens without the rename, or the rename happens without NOT NULL, the app code would break. A single migration ensures consistency.

### 4. Backfill strategy for existing waves

**Decision**:
- Waves with explicit `startDate`/`endDate`: preserve as-is
- Waves without dates but with photos: `startDate` = MIN(Photos.createdAt), `endDate` = MAX(Photos.createdAt)
- Waves without dates and no photos: `startDate` = Waves.createdAt, `endDate` = Waves.createdAt + 1 month
- Waves with `frozen=true` and NULL `endDate`: set `endDate` = MAX(Photos.createdAt) or Waves.createdAt (ensuring it's in the past so they stay frozen)

**Rationale**: Photo dates best represent the actual temporal span of a wave's content. For auto-grouped waves (which are always frozen), the newest photo date as `freezeDate` keeps them frozen since that date is always in the past.

### 5. `isFrozen` encompasses both pre-splash and post-freeze states

**Decision**: `_isWaveFrozen` returns true when `NOW() < splashDate OR NOW() > freezeDate`. This means a wave before its splash date is also "frozen" (no contributions allowed).

**Rationale**: The current code already blocks contributions before `startDate` via `_isWaveActive`. By folding this into `isFrozen`, we eliminate the `_isWaveActive` helper and the `isActive` GraphQL field entirely. The client only needs to check `isFrozen` — one field instead of two.

### 6. `isActive` removed entirely

**Decision**: Drop `isActive` from GraphQL schema, Wave model, and all controllers.

**Rationale**: `isActive` was always `!isFrozen`. With `isFrozen` now covering both pre-splash and post-freeze states, `isActive` is purely redundant. Clients can derive it client-side if needed.

### 7. Default dates on create

**Decision**: `createWave` accepts optional `splashDate` and `freezeDate`. Defaults: `splashDate = NOW()`, `freezeDate = NOW() + 30 days`.

**Rationale**: A newly created wave should be immediately active with a reasonable default window. 30 days matches the auto-group temporal gap threshold, providing consistency.

### 8. `updateWave` frozen-state behavior

**Decision**: When a wave is frozen (`NOW() > freezeDate`), only `freezeDate` changes are allowed (to unfreeze by pushing it into the future). The `frozen` parameter is removed from the mutation entirely.

**Rationale**: Direct mapping of the old behavior. Previously: "when frozen, only `frozen` and `endDate` can change." Now: "when frozen, only `freezeDate` can change." The `frozen` toggle is replaced by setting `freezeDate` to past (freeze) or future (unfreeze).

**Note**: `splashDate` changes are also blocked when frozen — same as the current behavior which blocks `startDate` changes on frozen waves.

## Risks / Trade-offs

**[Breaking GraphQL API]** → All clients must update simultaneously. Field renames and removals are not backward-compatible. Mitigation: coordinate mobile app release with backend deployment. No deprecation period since this is a small user base.

**[Data migration on production]** → Backfill queries join Waves with WavePhotos and Photos. Risk of slow execution on large datasets. Mitigation: the backfill uses subqueries with aggregates (MIN/MAX) which are efficient with existing indexes on WavePhotos(waveUuid) and Photos(createdAt).

**[Frozen waves with future endDate]** → Edge case: a wave has `frozen=true` AND `endDate` in the future. In the old model this wave is frozen (boolean wins). The migration must ensure `endDate` is moved to the past for these waves. Mitigation: migration step explicitly handles `frozen=true` waves by setting `endDate = LEAST(endDate, COALESCE(MAX(photo.createdAt), createdAt))`.

**[Auto-group controller change]** → `autoGroupPhotosIntoWaves` currently sets `frozen = true`. Must be updated to set `splashDate = MIN(photo.createdAt)` and `freezeDate = MAX(photo.createdAt)` instead. Low risk since it's a straightforward replacement.
