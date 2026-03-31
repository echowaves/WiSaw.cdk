## Why

The client needs a lightweight way to display how many photos a user is currently watching (e.g., a badge count) without fetching the full `feedForWatcher` paginated feed. Currently, the only way to know this count is to paginate through all watched photos, which is unnecessarily heavy for a simple number.

## What Changes

- Add a new `getWatchedCount(uuid: String!): Int!` GraphQL query that returns the count of active photos watched by the given uuid.
- The count only includes active photos (joins `Watchers` with `Photos` where `active = true`), staying consistent with what `feedForWatcher` returns.

## Capabilities

### New Capabilities
- `watched-count`: A query returning the number of active photos currently watched by a user, following the same lightweight count pattern as `getWavesCount` and `getUngroupedPhotosCount`.

### Modified Capabilities

_(none)_

## Impact

- **GraphQL schema**: New query field `getWatchedCount` added to `Query` type.
- **Lambda handler**: New case in the resolver dispatch (`lambda-fns/index.ts`).
- **Controller**: New file `lambda-fns/controllers/photos/getWatchedCount.ts`.
- **CDK resolvers**: New resolver mapping in `lib/resources/resolvers.ts`.
- **Database**: No schema changes — uses existing `Watchers` table (indexed on `uuid`) joined with `Photos`.
