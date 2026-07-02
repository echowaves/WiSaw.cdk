## Why

Four GraphQL queries (`listWaves`, `getFriendshipsList`, `feedForWave`, `feedForFriend`) expose configurable `sortBy` and `sortDirection` parameters that are not used by the client. Removing these parameters simplifies the API surface, reduces code complexity, and eliminates unused sorting paths.

## What Changes

- Remove `sortBy` and `sortDirection` parameters from `listWaves`, `getFriendshipsList`, `feedForWave`, and `feedForFriend` GraphQL queries
- Remove sort validation logic (whitelists, direction parsing) from all four controllers
- Hardcode default sort order per query: `createdAt DESC` for waves and friends lists; `updatedAt DESC` for photo feeds
- Remove unused `ALLOWED_SORT_FIELDS`, `ALLOWED_SORT_EXPRESSIONS`, and `ALLOWED_DIRECTIONS` constants from the affected controllers

## Capabilities

### Modified Capabilities

- `list-waves-sorting`: Removes `sortBy` and `sortDirection` parameters; default sort becomes `createdAt DESC`
- `friendships`: Removes `sortBy` and `sortDirection` parameters; default sort becomes `createdAt DESC`
- `feed-for-wave`: Removes `sortBy` and `sortDirection` parameters; default sort becomes `updatedAt DESC`
- `feed-for-friend`: Removes `sortBy` and `sortDirection` parameters; default sort becomes `updatedAt DESC`

## Impact

- **Backend**: `graphql/schema.graphql`, `lambda-fns/controllers/waves/listWaves.ts`, `lambda-fns/controllers/friendships/getFriendshipsList.ts`, `lambda-fns/controllers/friendships/feedForFriend.ts`, `lambda-fns/controllers/photos/feedForWave.ts`, `lambda-fns/index.ts`
- **Frontend**: React Native client queries passing these args will need removal (handled separately)
- **Breaking**: Yes — clients still passing `sortBy`/`sortDirection` to these queries will send unused arguments (harmless but dead code)
