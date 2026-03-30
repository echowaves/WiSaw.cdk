## Why

Full-text search queries on `Recognitions.metaData` and `Comments.comment` use `to_tsvector`/`plainto_tsquery` without GIN indexes, causing PostgreSQL to do full table scans on every search. With `feedByDate` running 15 parallel queries (each containing the FTS subquery), the Lambda times out at 30 seconds. All five photo feed queries are affected when a search term is provided.

## What Changes

- Add a GIN index on `to_tsvector('English', "metaData"::text)` for the `Recognitions` table
- Add a GIN index on `to_tsvector('English', "comment"::text)` for the `Comments` table
- Single migration file using raw SQL (as per convention for full-text search indexes)

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

_None — this is a performance fix. No spec-level behavior changes. The search results are identical, just faster._

## Impact

- **Database**: Two new GIN indexes on existing tables. Index creation may take time on large tables but runs within a transaction.
- **No code changes**: The existing `to_tsvector`/`plainto_tsquery` queries automatically use the indexes.
- **Performance**: FTS subqueries go from O(N) full scan to O(log N) index lookup.
