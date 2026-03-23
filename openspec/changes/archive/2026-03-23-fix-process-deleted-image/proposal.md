## Why

The `processDeletedImage` Lambda (S3 delete trigger) fails to delete photo records from the database when the photo belongs to a wave. The `_cleanupTables` function deletes from `Photos` first, but `WavePhotos` has a foreign key constraint on `photoId → Photos.id`, so PostgreSQL blocks the delete. The error is silently swallowed by a try/catch, leaving orphaned photo records in the database. Additionally, several SQL queries in this function use string interpolation instead of parameterized queries.

## What Changes

- **Reorder deletions**: Move `WavePhotos`, `Watchers`, `Recognitions`, and `Comments` deletions before the `Photos` deletion so FK constraints are satisfied.
- **Parameterize all SQL**: Replace string interpolation (`'${photoId}'`) with parameterized queries (`$1`) for `Photos`, `Watchers`, `Recognitions`, and `Comments` deletes (the `WavePhotos` queries already use `$1`).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `image-processing`: The S3 delete trigger cleanup now correctly handles photos that belong to waves by deleting dependent records before the photo record.

## Impact

- **Code**: `lambda-fns/lambdas/processDeletedImage/index.ts` — `_cleanupTables` function reordered and parameterized.
- **Behavior**: Photos in waves will now be properly cleaned up when S3 objects are deleted, instead of silently failing.
- **No API or schema changes.**
