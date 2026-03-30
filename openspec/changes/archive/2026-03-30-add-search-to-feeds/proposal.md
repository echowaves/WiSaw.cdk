## Why

The app currently has a dedicated search screen (`feedForTextSearch`) that searches photos by recognition labels and comments. Users must leave their current feed to search. Adding an optional search term to all photo feed queries lets users filter in-place — searching within the date feed, watcher feed, wave feed, or recent feed without navigating away. This unifies the search experience across the app.

## What Changes

- Add an optional `searchTerm: String` parameter to `feedByDate`, `feedForWatcher`, `feedForWave`, and `feedRecent` GraphQL queries
- Extract the full-text search SQL clause (Recognitions + Comments) into a reusable utility (`buildSearchClause`) so all feeds share the same search logic
- When `searchTerm` is provided, each feed filters results to only photos matching the FTS query (same logic as `feedForTextSearch`)
- When `searchTerm` is null/omitted, feeds behave exactly as before (backward compatible)
- Refactor `feedForTextSearch` to use the shared utility internally (no behavior change, kept for backward compatibility)

## Capabilities

### New Capabilities

_None — this extends existing capabilities._

### Modified Capabilities

- `photo-feed`: All PhotoFeed-returning queries gain an optional `searchTerm` parameter that filters results using PostgreSQL full-text search on Recognitions and Comments

## Impact

- **GraphQL schema**: 4 queries gain a new optional parameter (backward compatible)
- **Controllers**: `feedByDate.ts`, `feedForWatcher.ts`, `feedForWave.ts`, `feedRecent.ts` modified to accept and apply search filtering; `feedForTextSearch.ts` refactored to use shared utility
- **Utilities**: New `lambda-fns/utilities/searchClause.ts`
- **Dispatcher**: `lambda-fns/index.ts` updated to pass `searchTerm` argument for 4 queries
- **Resolvers**: No change (existing resolver mappings remain)
