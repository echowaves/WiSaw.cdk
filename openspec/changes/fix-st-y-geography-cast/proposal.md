## Why

The `autoGroupPhotosIntoWaves` GraphQL mutation crashes at runtime with `function st_y(geography) does not exist`. PostGIS functions `ST_Y()`, `ST_X()`, and `ST_ClusterDBSCAN()` accept only `geometry` types, but the `Photos.location` column is resolved as `geography` by PostgreSQL. The same issue likely affects `listPhotoLocations`. This needs a fix now because auto-grouping is completely broken.

## What Changes

- Add explicit `::geometry` casts to all PostGIS function calls on `Photos.location` in `autoGroupPhotosIntoWaves.ts` and `listPhotoLocations.ts`
- Specifically cast in `ST_Y(location::geometry)`, `ST_X(location::geometry)`, and `ST_ClusterDBSCAN(location::geometry, ...)`

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `auto-group-photos`: Cast `Photos.location` to `geometry` before passing to PostGIS functions so `ST_Y`, `ST_X`, and `ST_ClusterDBSCAN` accept the column
- `photo-locations`: Cast `Photos.location` to `geometry` before passing to PostGIS functions in the clustering query

## Impact

- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — SQL query updated
- `lambda-fns/controllers/waves/listPhotoLocations.ts` — SQL query updated
- No schema, migration, or API changes required
