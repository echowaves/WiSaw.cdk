## Spec Deltas: add-fts-gin-indexes

This change adds database indexes only. No functional requirements are modified — all existing behavior remains identical. Search results and ordering are unchanged.

### ADDED

**REQ-PERF-FTS-INDEX-1**: GIN index on Recognitions.metaData
> The database SHALL have a GIN index on `to_tsvector('English', "metaData"::text)` on the `Recognitions` table. This index SHALL be used by the full-text search subquery in `buildSearchClause`.

**REQ-PERF-FTS-INDEX-2**: GIN index on Comments.comment
> The database SHALL have a GIN index on `to_tsvector('English', "comment"::text)` on the `Comments` table, scoped to active comments. This index SHALL be used by the full-text search subquery in `buildSearchClause`.
