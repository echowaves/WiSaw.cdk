## Context

Five GraphQL queries return `PhotoFeed`: `feedByDate`, `feedForWatcher`, `feedForWave`, `feedRecent`, and `feedForTextSearch`. Currently, full-text search lives only in `feedForTextSearch`, which has its own inline SQL subquery searching Recognitions metadata and Comments text. The other four feeds have no search capability.

Each controller builds its own SQL query with different WHERE clauses, JOINs, and pagination strategies. The search logic needs to be injected as an additional filter clause that composes with each feed's existing query.

## Goals / Non-Goals

**Goals:**
- Add optional `searchTerm` to all four non-search feeds
- Extract search logic into a reusable utility
- Refactor `feedForTextSearch` to use the same utility
- Maintain full backward compatibility (null searchTerm = no filtering)

**Non-Goals:**
- Removing or deprecating `feedForTextSearch`
- Adding FTS indexes (can be done later if performance demands)
- Changing pagination behavior or page sizes

## Decisions

### 1. Reusable search clause utility

**Decision**: Create `lambda-fns/utilities/searchClause.ts` exporting a `buildSearchClause(searchTerm, paramStartIndex)` function that returns `{ clause: string, params: any[] }`.

**Rationale**: Each controller has a different number of existing query parameters, so the search clause needs to know which `$N` index to use. Returning a clause string + params array lets each controller append both to its existing query.

**Alternatives considered**:
- Inline the search SQL in each controller: Duplicates ~10 lines of SQL across 5 files. Rejected — violates DRY and makes changes error-prone.
- Use `$searchTerm IS NULL OR id IN (...)` single-query pattern: Rejected — requires the search term param in every query even when null, complicating param indexing. Dynamic clause insertion is cleaner.

### 2. Dynamic clause insertion (not conditional SQL)

**Decision**: When `searchTerm` is null/undefined, `buildSearchClause` returns `{ clause: '', params: [] }`. The controller interpolates an empty string and appends no extra params. When present, it returns the AND clause and the search term param.

**Rationale**: Keeps the SQL clean — no `IS NULL` short-circuit needed. The query sent to PostgreSQL is identical to today's query when no search term is provided. Zero overhead for non-search requests.

### 3. feedByDate search integration

**Decision**: Pass `searchTerm` into the `_retrievePhotos` helper. Each of the 15 parallel day-queries includes the search clause independently.

**Rationale**: The FTS subquery is fast (searches small-ish Recognitions and Comments tables) and PostgreSQL can cache plan/results. Pre-fetching IDs and passing an array would add complexity and a separate query. Keep it simple.

## Risks / Trade-offs

- **15× FTS subquery in feedByDate** → PostgreSQL handles this efficiently for current data volumes. If tables grow significantly, add GIN indexes on `to_tsvector` columns. Mitigation: monitor query times post-deploy.
- **No search result count** → Users won't know total matching results. Acceptable for MVP — consistent with existing `feedForTextSearch` behavior.
