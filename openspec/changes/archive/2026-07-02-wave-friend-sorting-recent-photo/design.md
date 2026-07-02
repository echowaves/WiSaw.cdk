## Context

Both `listWaves` and `getFriendshipsList` currently sort by metadata timestamps:
- `listWaves` sorts by `Waves.updatedAt` (wave metadata update time)
- `getFriendshipsList` sorts by `Friendships.createdAt` (friendship creation time)

Users expect "sort by recent" to show the wave/friend with the most recently uploaded photo first. The current behavior is misleading — a wave may have its metadata updated (e.g., name change) without any new photos, while a friend's most recent photo could be weeks old.

The existing `ALLOWED_SORT_FIELDS` whitelist in `listWaves.ts` and the SQL query in `getFriendshipsList.ts` are the two places that need modification. Both use parameterized queries and whitelist-based ORDER BY construction, which is the correct pattern to extend.

## Goals / Non-Goals

**Goals:**
- Add `recentPhoto` as a valid sort value for both `listWaves` and `getFriendshipsList`
- Sort by the most recent photo's `updatedAt` timestamp using correlated subqueries
- Maintain SQL injection safety via whitelist-based ORDER BY construction

**Non-Goals:**
- No new database columns (e.g., `lastPhotoAt`) — computed at query time
- No client-side sorting changes (friends A-Z remains client-side)
- No changes to default sort behavior
- No changes to the photos preview query

## Decisions

### Decision 1: Use correlated subqueries for `recentPhoto` sort

**Choice:** Use a correlated subquery in the ORDER BY clause to compute `MAX(Photos.updatedAt)` per wave/friend at query time.

**Rationale:**
- No schema migration required
- No trigger or background job needed to maintain a denormalized column
- The subquery is only evaluated during sorting, which is already a filtered/paginated operation
- For typical datasets (a user's own waves and friendships), the subquery cost is negligible

**Alternatives considered:**
1. **Add `lastPhotoAt` column to Waves/Friendships** — Would require a migration, a trigger or application-level maintenance, and additional writes. Overkill for a sort-only feature.
2. **Client-side sorting** — Requires fetching all records, which defeats pagination. Not viable for `listWaves` which is paginated.

**Implementation for `listWaves.ts`:**
Add to `ALLOWED_SORT_FIELDS`:
```typescript
recentPhoto: '(SELECT MAX(p."updatedAt") FROM "WavePhotos" wp JOIN "Photos" p ON p."id" = wp."photoId" WHERE wp."waveUuid" = "Waves"."waveUuid")'
```

**Implementation for `getFriendshipsList.ts`:**
Add to `ALLOWED_SORT_FIELDS`:
```typescript
recentPhoto: '(SELECT MAX("Photos"."updatedAt") FROM "Photos" WHERE "Photos"."uuid" = friend_uuid)'
```
Note: For friendships, the subquery references the friend UUID extracted from the friendship record. Since `getFriendshipsList` currently uses a single query with `DISTINCT ON`, we need a different approach — we'll compute the max photo date per friend using a `LEFT JOIN LATERAL` or a window function approach.

**Revised approach for `getFriendshipsList.ts`:**
The query will be restructured to:
1. First get confirmed friend UUIDs from Friendships
2. LEFT JOIN with a subquery that computes `MAX(Photos.updatedAt)` per UUID
3. ORDER BY the computed max photo date when `recentPhoto` sort is selected

### Decision 2: Reuse existing whitelist pattern

**Choice:** Extend the existing `ALLOWED_SORT_FIELDS` map pattern in both controllers.

**Rationale:**
- Consistent with existing code style
- Already proven safe against SQL injection
- Minimal code change

### Decision 3: Keep default sort behavior unchanged

**Choice:** `recentPhoto` is an opt-in sort option. Default sorting remains `updatedAt DESC` for waves and `createdAt DESC` for friendships.

**Rationale:**
- No breaking change
- Users explicitly choose the new behavior

## Risks / Trade-offs

[Risk] Correlated subquery performance on large datasets → Mitigation: The `WavePhotos` table already has indexes on `waveUuid` and `photoId`. The subquery is scoped to a single wave/friend per row, and the total number of rows is limited by pagination (20 per page). For typical usage, this is negligible.

[Risk] Subquery evaluates to NULL when a wave/friend has no photos → Mitigation: NULL values sort last in ASC order and first in DESC order (PostgreSQL default), which is acceptable behavior — waves/friends without photos naturally appear at the end of "recent" sort.

[Risk] `getFriendshipsList` query restructuring increases complexity → Mitigation: The current query already uses `DISTINCT ON` and batch photo loading. The sort addition uses the same pattern already used in the photos batch query (ORDER BY `Photos.updatedAt DESC`), extended to the friendship level.