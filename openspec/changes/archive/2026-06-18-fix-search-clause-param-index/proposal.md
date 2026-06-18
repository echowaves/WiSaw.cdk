## Why

Four Lambda controller files are using incorrect parameter index `2` when calling `buildSearchClause()`, causing SQL query parameter conflicts. The function generates SQL placeholders starting at the specified index, but index `$2` is already used for `OFFSET` in all affected queries, while the search term should use index `$3`.

This is a regression introduced when the `buildSearchClause()` function's parameter order was refactored to accept `paramStartIndex` instead of `searchTerm` as the second parameter. The callers were not updated to reflect that the search term now goes at position `$3` (after `$1=limit` and `$2=offset`).

## What Changes

- Fix `buildSearchClause(searchTerm, 2)` → `buildSearchClause(searchTerm, 3)` in 4 files:
  - `lambda-fns/controllers/photos/feedForTextSearch.ts` line 17
  - `lambda-fns/controllers/photos/feedRecent.ts` line 17
  - `lambda-fns/controllers/photos/feedForUngrouped.ts` line 21
  - `lambda-fns/controllers/friendships/feedForFriend.ts` line 67

- No breaking changes - this fixes incorrect behavior, not API changes.

## Capabilities

### Modified Capabilities
- `photo-feed-search`: Search functionality in photo feed queries. The bug causes search to use wrong SQL parameters, potentially returning incorrect results or query errors.

## Impact

**Affected Files:**
- `lambda-fns/controllers/photos/feedForTextSearch.ts` - Text search feed
- `lambda-fns/controllers/photos/feedRecent.ts` - Recent photos feed
- `lambda-fns/controllers/photos/feedForUngrouped.ts` - Ungrouped photos feed
- `lambda-fns/controllers/friendships/feedForFriend.ts` - Friend's photos feed

**Affected Systems:**
- AWS Lambda functions that handle photo feed queries with search
- PostgreSQL queries using full-text search on Recognitions and Comments tables

**Behavior Change:**
- Before: Search term was bound to `$2` parameter, which conflicts with `OFFSET`
- After: Search term correctly bound to `$3` parameter
