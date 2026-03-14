## Context

The `listWaves` controller already fetches all active photo thumbnail URLs per wave via a batch query joining `WavePhotos` and `Photos`. The current query returns unbounded photos per wave (up to 1000) and provides no count. The client needs at most 5 preview thumbnails and a total count for display badges.

## Goals / Non-Goals

**Goals:**
- Limit photos returned per wave to 5 (most recent by `createdAt`)
- Return total active photo count per wave as `photosCount`
- Keep the batch query approach (single query for all waves on the page)

**Non-Goals:**
- Changing the photo ordering or filtering logic
- Adding pagination of photos within a wave (existing `feedRecent`/`feedByDate` handles that)

## Decisions

**1. Use a window function (`ROW_NUMBER()`) to limit photos per wave to 5 in SQL**
- Rationale: Applying the limit server-side in a single query avoids fetching all photos and truncating in application code. `ROW_NUMBER() OVER (PARTITION BY waveUuid ORDER BY createdAt DESC)` assigns a rank per wave, then filter to `row_num <= 5`.
- Alternative: Fetch all and slice in JS — rejected because it transfers unnecessary data from the database.

**2. Fetch counts in the same query using a separate `COUNT(*) OVER (PARTITION BY waveUuid)`**
- Rationale: Avoids a second round-trip. The window function computes the count alongside the row numbers in a single pass.
- Alternative: Separate count query — simpler SQL but adds a second query per request.

## Risks / Trade-offs

- [Window function complexity] → Slightly more complex SQL, but standard PostgreSQL and well-tested pattern. The query remains a single batch across all waves on the page.
