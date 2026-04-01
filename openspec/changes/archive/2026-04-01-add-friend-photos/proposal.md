## Why

Users need to view their friends' photos. Currently, friendships only support chat — there's no way to browse a friend's photos or see a preview of their recent photos in the friendships list. Adding photo visibility to friendships makes the social connection more visual and engaging.

## What Changes

- **Enhance `getFriendshipsList`**: Return up to 5 recent active photos per friend, attached as a `photos: [Photo]` field on the `Friendship` type (same pattern as `Wave.photos` in `listWaves`).
- **Add `feedForFriend` query**: New paginated photo feed for a specific friend's photos, with search, optional sorting (`createdAt`/`updatedAt`, `ASC`/`DESC`), and friendship validation (must be an accepted friendship between `uuid` and `friendUuid`).
- **Add sorting to `feedForWave`**: Add optional `sortBy` and `sortDirection` parameters to the existing `feedForWave` query, supporting `createdAt`/`updatedAt` with `ASC`/`DESC` (defaulting to current behavior: `updatedAt DESC`).

## Capabilities

### New Capabilities
- `feed-for-friend`: Paginated photo feed for a specific friend's photos, with friendship validation, search, and sorting.
- `friendship-photos-preview`: Up to 5 recent active photos per friend returned in the friendships list.

### Modified Capabilities
- `feed-for-wave`: Adding optional `sortBy` and `sortDirection` parameters.
- `friendships`: Adding `photos: [Photo]` field to the `Friendship` GraphQL type.

## Impact

- **GraphQL schema**: New `feedForFriend` query, new `photos` field on `Friendship` type, new optional params on `feedForWave`.
- **Controllers**: New `feedForFriend.ts`, modified `feedForWave.ts`, modified `getFriendshipsList.ts`.
- **Dispatcher**: New handler in `lambda-fns/index.ts`.
- **CDK resolvers**: New resolver mapping in `lib/resources/resolvers.ts`.
- **Database**: No schema changes — queries use existing `Friendships` and `Photos` tables with existing indexes.
