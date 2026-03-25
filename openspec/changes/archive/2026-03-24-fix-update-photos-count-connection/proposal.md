## Why

The `_updatePhotosCount` helper manages its own `psql.connect()` / `psql.clean()` lifecycle, which breaks callers that invoke it mid-transaction. When `_updatePhotosCount` calls `psql.clean()`, it releases the shared connection. Subsequent `psql.query()` calls in the caller operate on a degraded or disconnected client, causing silent failures, null returns from AppSync, and the `pg` deprecation warning about overlapping queries.

This bug affects `mergeWaves` (cannot return Wave), `addPhotoToWave` (queries after auto-move), and `autoGroupPhotosIntoWaves` (count queries after wave creation).

## What Changes

- Remove `psql.connect()` and `psql.clean()` from `_updatePhotosCount`, making it a pure query helper that expects the caller to manage the connection lifecycle.
- Audit and fix all callers to ensure they call `psql.connect()` before and `psql.clean()` after their full operation, including `_updatePhotosCount` calls.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `wave-merge`: The `mergeWaves` mutation will now complete successfully because the connection stays alive through `_updatePhotosCount` to the final SELECT.

## Impact

- **Code**: `lambda-fns/controllers/waves/_updatePhotosCount.ts` — remove connect/clean.
- **Callers affected** (4 files):
  - `mergeWaves.ts` — already manages connect/clean correctly; fix is automatic.
  - `addPhoto.ts` — already manages connect/clean correctly; fix is automatic.
  - `removePhoto.ts` — already manages connect/clean correctly; fix is automatic.
  - `autoGroupPhotosIntoWaves.ts` — already manages connect/clean correctly; fix is automatic.
- **Standalone caller** (1 file):
  - `processDeletedImage/index.ts` — calls `_updatePhotosCount` within its own connect/clean block; fix is automatic.
- **No schema, API, or migration changes.**
