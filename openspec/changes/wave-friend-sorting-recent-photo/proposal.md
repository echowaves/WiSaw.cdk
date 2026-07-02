## Why

The listWaves and getFriendshipsList queries currently sort by metadata timestamps (Waves.updatedAt, Friendships.createdAt) rather than by the most recent photo activity within waves and friendships. Users expect "sort by recent" to show the wave/friend with the newest photo first, not the one with the most recently updated metadata. This creates confusion when waves or friends haven't been interacted with recently but have recent photos.

## What Changes

- Add `recentPhoto` sort option to `listWaves` that orders waves by the most recent photo's `updatedAt` timestamp
- Add `recentPhoto` sort option to `getFriendshipsList` that orders friends by the most recent photo's `updatedAt` timestamp
- Both use correlated subqueries to compute the sort key at query time (no new database columns)

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `list-waves-sorting`: ADDS `recentPhoto` as a valid value for the `sortBy` parameter on `listWaves`
- `friendships`: ADDS `recentPhoto` as a valid value for the `sortBy` parameter on `getFriendshipsList`

## Impact

- **Code**: `lambda-fns/controllers/waves/listWaves.ts`, `lambda-fns/controllers/friendships/getFriendshipsList.ts`, `graphql/schema.graphql`, `lambda-fns/index.ts`
- **API**: GraphQL schema additions — new `recentPhoto` sort option for `listWaves` and `getFriendshipsList`
- **Database**: No new migrations or columns needed (correlated subqueries)