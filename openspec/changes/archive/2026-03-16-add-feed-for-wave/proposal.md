## Why

The four existing feed queries (`feedByDate`, `feedRecent`, `feedForWatcher`, `feedForTextSearch`) each carry an optional `waveUuid` parameter that conditionally JOINs the `WavePhotos` table. This scatters wave-filtering logic across four controllers, making each one more complex. A dedicated `feedForWave` query provides a cleaner separation — clients browsing a wave use one endpoint, and the general-purpose feeds stay simple.

## What Changes

- Add a new `feedForWave` GraphQL query that returns paginated photos for a given wave, modeled after `feedForWatcher` mechanics (page-number pagination, `row_number()` window, `updatedAt` ordering, 100-photo pages).
- **BREAKING**: Remove the optional `waveUuid` parameter from `feedByDate`, `feedForWatcher`, `feedRecent`, and `feedForTextSearch` queries in the GraphQL schema.
- Remove the conditional `JOIN "WavePhotos"` / `AND waveUuid = ...` logic from all four existing feed controllers.
- Add new controller `lambda-fns/controllers/photos/feedForWave.ts`.
- Wire the new query in `lambda-fns/index.ts`.
- Add the new resolver mapping in the CDK stack.

## Capabilities

### New Capabilities

- `feed-for-wave`: Dedicated paginated feed query that returns photos belonging to a specific wave.

### Modified Capabilities

- `photo-feed`: Removing optional `waveUuid` filtering from all four existing feed queries.

## Impact

- **Code**: New file `lambda-fns/controllers/photos/feedForWave.ts`. Modifications to `feedByDate.ts`, `feedRecent.ts`, `feedForWatcher.ts`, `feedForTextSearch.ts`, `index.ts`, `schema.graphql`, and the CDK stack resolvers.
- **APIs**: Breaking GraphQL schema change — `waveUuid` parameter removed from 4 queries, 1 new query added. Clients must update to use `feedForWave` instead of passing `waveUuid` to other feeds.
- **Dependencies**: None.
- **Systems**: AppSync GraphQL API, Lambda resolver.
