## 1. GraphQL Schema

- [x] 1.1 Add `waveName: String` and `waveUuid: String` to `PhotoDetails` type in `graphql/schema.graphql`

## 2. Wave Info Helper

- [x] 2.1 Create `lambda-fns/controllers/photos/_getWaveInfo.ts` that queries `WavePhotos JOIN Waves` for a photoId and returns `{ waveName, waveUuid }` or nulls

## 3. PhotoDetails Controller

- [x] 3.1 Update `lambda-fns/controllers/photos/getPhotoDetails.ts` to call `_getWaveInfo` in parallel and include `waveName` and `waveUuid` in the return

## 4. Single-Wave Enforcement

- [x] 4.1 Update `lambda-fns/controllers/waves/addPhoto.ts` to check if the photo is already in any wave before inserting, and throw an error if it belongs to a different wave
