## Why

The app already shows how many ungrouped photos a user has (`getUngroupedPhotosCount`) but provides no way to browse them. Users need a paginated feed of their photos that haven't been assigned to any wave, so they can review and organize them.

## What Changes

- Add a new `feedForUngrouped` GraphQL query returning a `PhotoFeed` with pagination, mirroring `feedForWave` but filtering to photos NOT in any wave
- Add a new controller `lambda-fns/controllers/photos/feedForUngrouped.ts`
- Wire the new query through the Lambda handler and AppSync resolver
- Support optional `searchTerm` for consistency with other feeds

## Capabilities

### New Capabilities
- `feed-for-ungrouped`: Paginated feed of a user's active photos that are not assigned to any wave, with optional full-text search filtering

### Modified Capabilities

## Impact

- `graphql/schema.graphql` — new query `feedForUngrouped`
- `lambda-fns/controllers/photos/feedForUngrouped.ts` — new controller
- `lambda-fns/index.ts` — import + handler wiring
- `lib/resources/resolvers.ts` — new resolver entry
