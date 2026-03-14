## Why

The `listWaves` API currently returns only wave metadata (name, location, dates). Clients need photo thumbnail URLs for each wave to display visual previews in the wave list without making separate per-wave API calls.

## What Changes

- Add a `photos` field (list of thumbnail URL strings) to the `Wave` GraphQL type
- Update `listWaves` controller to batch-fetch associated photo thumbnail URLs via `WavePhotos` and `Photos` tables
- Update the `Wave` TypeScript model to include the `photos` field

## Capabilities

### New Capabilities

### Modified Capabilities
- `waves`: The `listWaves` response will include photo thumbnail URLs for each wave

## Impact

- `graphql/schema.graphql` — `Wave` type gains a `photos: [String]` field
- `lambda-fns/controllers/waves/listWaves.ts` — additional SQL query to fetch photo URLs per wave
- `lambda-fns/models/wave.ts` — add `photos` property
- No new dependencies, migrations, or CDK infrastructure changes required
