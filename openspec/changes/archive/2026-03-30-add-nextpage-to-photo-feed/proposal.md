## Why

When `feedByDate` is called with a `searchTerm`, sparsely matching results cause the client to receive empty photo batches for many consecutive 15-day windows. The client has no way to know whether more results exist further back in time without making additional calls — each returning empty. This wastes round-trips and creates a poor UX where the feed appears to have ended prematurely.

## What Changes

- Add `nextPage: Int` (nullable) to the `PhotoFeed` GraphQL type, telling the client which page/daysAgo to use for its next request
- In `feedByDate` with a `searchTerm`: the server loops internally (up to 10 iterations), scanning successive 15-day windows until it finds results or reaches `whenToStop`. Returns `nextPage` pointing to the next unscanned window.
- In `feedByDate` without a `searchTerm`: no loop, `nextPage = daysAgo + 1` (preserves current behavior)
- In all offset-based feeds (`feedRecent`, `feedForWatcher`, `feedForWave`, `feedForTextSearch`): `nextPage = pageNumber + 1` when results exist, `null` when `noMoreData` is true. No loop needed — search filtering happens in the WHERE clause so pages are dense.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `photo-feed`: Add `nextPage` field to PhotoFeed response. Add server-side scan-ahead loop in feedByDate when searchTerm is provided.

## Impact

- **GraphQL schema**: `PhotoFeed` type gains `nextPage: Int` field
- **Controllers**: All 5 feed controllers updated to return `nextPage`
- **feedByDate**: Gains loop logic with configurable max iterations (10) when searchTerm is present
- **Client**: Can use `nextPage` instead of computing next page/daysAgo locally — skipping empty ranges
