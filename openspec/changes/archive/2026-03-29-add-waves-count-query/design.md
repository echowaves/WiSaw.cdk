## Context

The app already has `getUngroupedPhotosCount` — a simple count query that validates a UUID, runs `SELECT COUNT(*)`, and returns an integer. `getWavesCount` follows the exact same pattern, querying `WaveUsers` instead of `Photos`.

## Goals / Non-Goals

**Goals:**
- Provide a fast count of waves a user belongs to for UI badge display

**Non-Goals:**
- Filtered counts (by search term, wave type, etc.)
- Caching or denormalization of the count

## Decisions

**Follow the `getUngroupedPhotosCount` pattern exactly**: Same structure — validate UUID, `psql.connect()`, `SELECT COUNT(*)::int`, `psql.clean()`, return number. No new patterns introduced.

**Query `WaveUsers` table, not `Waves`**: A user's waves are determined by their membership in `WaveUsers`, not by `Waves.createdBy`. This matches how `listWaves` filters waves.

## Risks / Trade-offs

- None — simple read-only query on an indexed table.
