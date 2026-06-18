## Why

The bookmarked photos search is broken with error: "argument of OFFSET must be type bigint, not type text". This happens because `feedForWatcher.ts` uses `buildSearchClause(searchTerm, 3)` which generates SQL with `$3` for the search term, but `$3` is already used for OFFSET in the query. The search term (string) gets bound to OFFSET instead of the offset number.

## What Changes

- Fix `buildSearchClause(searchTerm, 3)` → `buildSearchClause(searchTerm, 4)` in `lambda-fns/controllers/photos/feedForWatcher.ts` line 21

## Capabilities

### Modified Capabilities
- `photo-feed-search`: Search functionality in bookmarked photos feed. The bug causes OFFSET to receive search term string instead of offset number.

## Impact

**Affected Files:**
- `lambda-fns/controllers/photos/feedForWatcher.ts` - Bookmarked photos feed with search

**Behavior Change:**
- Before: Search term bound to `$3` (OFFSET position), causing type error
- After: Search term correctly bound to `$4` position
