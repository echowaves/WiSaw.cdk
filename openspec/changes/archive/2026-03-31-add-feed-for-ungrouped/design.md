## Context

The app has `feedForWave` which returns paginated photos belonging to a specific wave, and `getUngroupedPhotosCount` which counts photos not in any wave. There is no endpoint to actually list those ungrouped photos. The new `feedForUngrouped` query fills this gap.

## Goals / Non-Goals

**Goals:**
- Provide a paginated feed of ungrouped photos scoped to a device UUID
- Follow existing feed patterns (PhotoFeed return type, LIMIT/OFFSET pagination, optional searchTerm)

**Non-Goals:**
- No new database schema or migrations needed — the query uses existing tables (Photos, WavePhotos)
- No changes to the PhotoFeed type or existing feeds

## Decisions

### Query pattern: LEFT JOIN + IS NULL
Mirror `getUngroupedPhotosCount` which already uses `LEFT JOIN WavePhotos ON Photos.id = WavePhotos.photoId WHERE WavePhotos.photoId IS NULL`. This is the standard PostgreSQL anti-join pattern.

**Alternative considered:** `NOT IN (SELECT photoId FROM WavePhotos)` — functionally equivalent but LEFT JOIN + IS NULL is generally preferred for performance with large tables and handles NULLs correctly.

### Scoping by device UUID
Ungrouped photos are scoped by `Photos.uuid` (the uploading device), consistent with `getUngroupedPhotosCount`. This ensures users only see their own ungrouped photos.

### Ordering by updatedAt DESC
Matches `feedForWave` ordering. Most recently touched photos appear first.

### Search support via buildSearchClause
Include optional `searchTerm` for consistency with all other feeds. The search clause uses `p."id" IN (...)` which doesn't conflict with the LEFT JOIN.

## Risks / Trade-offs

- **Performance on large datasets** → The LEFT JOIN anti-join is well-optimized in PostgreSQL. The existing index on WavePhotos.photoId covers the join. No additional indexing needed.
- **No new index on Photos.uuid** → Assuming one already exists or the table is small enough. If performance is an issue, an index on `(uuid, active)` would help.
