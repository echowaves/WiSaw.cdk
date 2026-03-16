## Why

Photos can currently be added to multiple waves simultaneously. The data model supports it (composite PK on `waveUuid, photoId`) but the intended behavior is one wave per photo. Without enforcement, data integrity depends on the client not calling `addPhotoToWave` for photos already in a wave. Additionally, `getPhotoDetails` returns no wave information, so the client has no way to know which wave a photo belongs to.

## What Changes

- Enforce one-wave-per-photo at the app level in `addPhotoToWave`: check if the photo is already in any wave before inserting, throw an error if so
- Add `waveName` and `waveUuid` fields to the `PhotoDetails` GraphQL type so clients can see which wave a photo belongs to
- Add a `_getWaveInfo` helper to query wave association for a photo
- Update `getPhotoDetails` controller to fetch and return wave info alongside existing data

## Capabilities

### New Capabilities
- `photo-wave-info`: Return wave name and UUID as part of photo details

### Modified Capabilities
- `waves`: Enforce that a photo can only belong to one wave at a time

## Impact

- `graphql/schema.graphql` — `PhotoDetails` type gains `waveName: String` and `waveUuid: String`
- `lambda-fns/controllers/waves/addPhoto.ts` — add pre-insert check
- `lambda-fns/controllers/photos/getPhotoDetails.ts` — add wave info fetch
- `lambda-fns/controllers/photos/_getWaveInfo.ts` — new helper
- No migrations needed (app-level enforcement only)
- No breaking changes to existing API contracts (new fields are nullable)
