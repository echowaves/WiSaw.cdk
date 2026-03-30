## Context

`feedByDate` queries 15 consecutive days in parallel per call. When a `searchTerm` filters out all results in a window, the client receives empty photos and must decide whether to keep calling. The client currently has no server-side guidance on where to resume, leading to either premature feed termination or many empty round-trips.

The other four offset-based feeds (feedRecent, feedForWatcher, feedForWave, feedForTextSearch) don't have this sparsity problem — the search WHERE clause filters before LIMIT/OFFSET, so pages contain only matching photos.

## Goals / Non-Goals

**Goals:**
- Eliminate empty round-trips for feedByDate with search by scanning ahead server-side
- Provide a `nextPage` hint in all PhotoFeed responses for client convenience
- Keep backward compatibility — existing clients ignore `nextPage` and work as before

**Non-Goals:**
- Changing the pagination model for offset-based feeds (no server-side loop needed)
- Changing the 15-parallel-day-query architecture of feedByDate
- Pre-fetching IDs or restructuring the search subquery

## Decisions

### Server-side scan-ahead loop in feedByDate (when searchTerm is provided)

**Decision**: When `searchTerm` is present, wrap the existing 15-day parallel query in a loop that increments `daysAgo` until results are found, `whenToStop` is reached, or a max iteration cap is hit.

**Rationale**: Pushes the scan-ahead to the server, eliminating empty round-trips. The client always receives either results or a definitive `noMoreData: true`.

**Alternatives considered**:
- Client-side retry loop: More round-trips, worse UX, higher latency. Rejected.
- Single large date-range query (no windowing): Fundamentally changes feedByDate's architecture and row_number offset scheme. Too invasive. Rejected.

### Max iteration cap of 10

**Decision**: Limit the scan-ahead loop to 10 iterations (10 × 15 = 150 days scanned per call).

**Rationale**: With a 30-second Lambda timeout and each iteration running 15 parallel DB queries, 10 iterations is a safe upper bound. If exhausted without results, return `noMoreData: false` with `nextPage` pointing to the resume position — the client makes another call to continue scanning.

### nextPage semantics by feed type

**Decision**: `nextPage` is nullable (`Int`). For feedByDate it represents the next `daysAgo` value. For offset-based feeds it represents the next `pageNumber`. When `noMoreData` is true, `nextPage` is null.

**Rationale**: Unified field on PhotoFeed type, interpreted by the client based on which feed it called. Keeps the GraphQL schema simple — one type fits all.

### No loop for offset-based feeds

**Decision**: feedRecent, feedForWatcher, feedForWave, and feedForTextSearch set `nextPage = pageNumber + 1` when results exist, `null` when `noMoreData` is true. No scan-ahead loop.

**Rationale**: These feeds paginate over the WHERE-filtered result set. Pages are dense — an empty page truly means no more data. No sparsity problem to solve.

### No loop for feedByDate without searchTerm

**Decision**: When no searchTerm is provided, feedByDate behaves exactly as today with `nextPage = daysAgo + 1`. No loop.

**Rationale**: Without search filtering, every day window returns whatever photos exist for that date range. The current single-iteration behavior is correct.

## Risks / Trade-offs

- **Increased DB load per call**: A single feedByDate call with search could execute up to 150 queries (10 iterations × 15 days). Mitigation: GIN indexes (already deployed) make each FTS query fast. The cap prevents runaway execution.
- **Lambda timeout**: 10 iterations should complete well within 30 seconds with indexed FTS queries. If GIN indexes are missing, this could time out. Mitigation: GIN indexes are a prerequisite (already deployed).
- **Behavioral change**: feedByDate with search now returns results from potentially much older date ranges in a single call. This is the intended behavior — clients should display the photos regardless of age.
