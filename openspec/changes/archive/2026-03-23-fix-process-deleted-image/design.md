## Context

The `processDeletedImage` Lambda is triggered by S3 delete events. It extracts the `photoId` from the S3 object key and cleans up related database records. Currently, the `_cleanupTables` function deletes from `Photos` first, then `Watchers`, `WavePhotos`, `Recognitions`, and `Comments`. The `WavePhotos` table has a foreign key constraint `photoId → Photos.id`, which causes the `Photos` DELETE to fail when the photo belongs to a wave. The error is caught and logged but execution continues, leaving orphaned `Photos` records. Additionally, `Photos`, `Watchers`, `Recognitions`, and `Comments` DELETEs use string interpolation rather than parameterized queries.

## Goals / Non-Goals

**Goals:**
- Fix deletion order so FK constraints are satisfied (dependent tables first, then `Photos` last).
- Use parameterized queries (`$1`) for all SQL statements to prevent SQL injection.

**Non-Goals:**
- Changing the S3 trigger configuration or Lambda wiring.
- Adding new tables to the cleanup process (e.g., `AbuseReports`).
- Wrapping all deletes in a single transaction (current independent try/catch pattern is acceptable).

## Decisions

**Decision 1: Delete dependent tables first, `Photos` last.**
The correct deletion order is: `WavePhotos` → `Watchers` → `Recognitions` → `Comments` → `Photos`. This ensures no FK constraint blocks the `Photos` delete. The existing `WavePhotos` block already handles `_updatePhotosCount`, so it just needs to be moved to execute first.

**Decision 2: Parameterize all SQL queries.**
Replace `'${photoId}'` string interpolation with `$1` parameterized queries for `Photos`, `Watchers`, `Recognitions`, and `Comments` deletes. The `WavePhotos` queries already use `$1`.

## Risks / Trade-offs

- **[Risk] Other unknown FK constraints** → Mitigated: verified via migration files that only `WavePhotos` has a FK on `photoId → Photos.id`. `Comments`, `Watchers`, `Recognitions` do not have FK constraints.
- **[Risk] Partial cleanup if middle step fails** → Accepted: current pattern uses independent try/catch per table, so a failure in one table doesn't block others. This is existing behavior and acceptable for a cleanup lambda.
