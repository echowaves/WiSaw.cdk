## Context

The `Photos.location` column was created via Sequelize as `GEOMETRY('POINT')`, but PostgreSQL resolves it as `geography` at runtime. PostGIS accessor functions `ST_Y()`, `ST_X()`, and the clustering function `ST_ClusterDBSCAN()` only accept `geometry` arguments, causing `autoGroupPhotosIntoWaves` (and potentially `listPhotoLocations`) to crash with `function st_y(geography) does not exist`.

## Goals / Non-Goals

**Goals:**
- Fix the runtime crash by casting `location` to `geometry` when passing it to PostGIS functions
- Apply the same fix to `listPhotoLocations` which uses the same pattern and would hit the same error

**Non-Goals:**
- Changing the column type itself via a migration (risky, unnecessary — casting is the standard PostGIS approach)
- Refactoring how location data is stored or indexed
- Modifying any other queries that don't use these specific PostGIS functions

## Decisions

### Decision: Use `::geometry` cast in SQL rather than altering the column type

**Rationale**: Casting `location::geometry` in the query is the standard PostGIS approach for using geometry functions on geography columns. It's a minimal, non-breaking change that requires no migration, no downtime, and no data changes.

**Alternative considered**: Running a migration to change the column type from `geography` to `geometry`. Rejected because it requires data migration, carries rollback risk, and may affect other queries or indexes that work with the current type.

### Decision: Fix both `autoGroupPhotosIntoWaves.ts` and `listPhotoLocations.ts`

**Rationale**: Both files use the same `ST_Y()`, `ST_X()`, and `ST_ClusterDBSCAN()` pattern on `Photos.location`. Fixing only one would leave the other broken or fragile.

## Risks / Trade-offs

- [Implicit type mismatch in future queries] → Developers must remember to cast `location::geometry` when using geometry-specific PostGIS functions. Mitigated by the existing `database-access-patterns` spec which can be updated.
- [Minimal performance overhead from cast] → Negligible for the query sizes involved.
