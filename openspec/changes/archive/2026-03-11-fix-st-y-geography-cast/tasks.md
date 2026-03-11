## 1. Fix autoGroupPhotosIntoWaves

- [x] 1.1 Cast `"Photos".location` to `::geometry` in `ST_Y()`, `ST_X()`, and `ST_ClusterDBSCAN()` calls in `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`

## 2. Fix listPhotoLocations

- [x] 2.1 Cast `location` to `::geometry` in `ST_ClusterDBSCAN()`, `ST_Y()`, and `ST_X()` calls in `lambda-fns/controllers/waves/listPhotoLocations.ts`

## 3. Verify

- [x] 3.1 Run TypeScript compilation to confirm no syntax or type errors
