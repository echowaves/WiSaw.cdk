## Why

The `listWaves` API currently returns all photo thumbnail URLs for each wave with no limit. Waves can contain up to 1000 photos, resulting in unnecessarily large payloads for the wave list view. The client also needs to display a total photo count badge but has no way to get it without fetching the full photo feed.

## What Changes

- Limit the `photos` array in each wave to the first 5 thumbnail URLs (most recent)
- Add a `photosCount` field to the `Wave` type returning the total number of active photos in the wave
- Update the SQL query to fetch counts and apply the 5-photo limit server-side

## Capabilities

### New Capabilities

### Modified Capabilities
- `waves`: `listWaves` response limits photos to 5 per wave and includes a total `photosCount`

## Impact

- `graphql/schema.graphql` — add `photosCount: Int` to `Wave` type
- `lambda-fns/models/wave.ts` — add `photosCount` property
- `lambda-fns/controllers/waves/listWaves.ts` — limit photo query to 5 per wave, add count query
