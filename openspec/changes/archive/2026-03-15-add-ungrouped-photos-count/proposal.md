## Why

The client needs to display a count of photos that haven't been grouped into any wave yet, so the user knows there are ungrouped photos to process. Currently there's no API to get this count — the only way to know is to run `autoGroupPhotosIntoWaves` and check `photosRemaining`, which is a mutation with side effects.

## What Changes

- Add a new GraphQL query `getUngroupedPhotosCount(uuid: String!): Int!` that returns the count of active photos for a given UUID that have no `WavePhotos` association
- Add a new controller `lambda-fns/controllers/waves/getUngroupedPhotosCount.ts`
- Register the query in the resolver dispatch (`lambda-fns/index.ts`)

## Capabilities

### New Capabilities
- `ungrouped-photos-count`: Query to return the number of active photos not belonging to any wave for a given user

### Modified Capabilities

## Impact

- `graphql/schema.graphql` — new query `getUngroupedPhotosCount`
- `lambda-fns/controllers/waves/getUngroupedPhotosCount.ts` — new controller
- `lambda-fns/index.ts` — register new query handler
