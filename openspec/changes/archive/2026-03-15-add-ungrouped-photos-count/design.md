## Context

The project already has a query pattern for counting ungrouped photos — `autoGroupPhotosIntoWaves.ts` uses `LEFT JOIN "WavePhotos" ... WHERE "WavePhotos"."photoId" IS NULL` to find them. The new query reuses this exact SQL pattern but as a read-only COUNT.

The resolver dispatch in `index.ts` uses a `queryHandlers` record mapping field names to handler definitions. Adding a new query follows the same pattern.

## Goals / Non-Goals

**Goals:**
- Provide a lightweight read-only query to get ungrouped photos count
- Follow existing controller and resolver patterns

**Non-Goals:**
- Returning the ungrouped photos themselves (existing feeds handle that)
- Caching or persisting the count (it's a simple COUNT query)

## Decisions

**1. Direct COUNT query (not a persisted column)**
- Rationale: Unlike `photosCount` on waves (which changes on specific write events), ungrouped count changes any time a photo is created, deleted, or grouped. A persisted column would need updates in too many places. A simple COUNT query is appropriate for this read-only use case.

**2. Same LEFT JOIN pattern as autoGroupPhotosIntoWaves**
- Rationale: Proven query pattern already in use. Counts active photos for the UUID that have no matching WavePhotos row.

## Risks / Trade-offs

- [Query cost] → Single COUNT with a LEFT JOIN. Efficient with existing indexes on `Photos.uuid` and `WavePhotos.photoId`.
