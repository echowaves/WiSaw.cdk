## Context

See `proposal.md` for motivation. The relevant current state:

- `getPhotoDetails(photoId, uuid)` (`lambda-fns/controllers/photos/getPhotoDetails.ts`) returns `comments`, `recognitions`, `isPhotoWatched`, `waveName`, `waveUuid` by fanning out to underscore-prefixed read helpers via a single `Promise.all`. It already receives and validates `photoId` + `uuid` (both asserted as UUIDs) but today ignores `uuid` for any per-photo aggregation.
- The feed's per-photo bookmark count is a **denormalized column** `Photos.watchersCount`, served straight from the row (`SELECT p.*` in `feedByDate.ts`, mapped via the `Photo` model). It is maintained by exactly one writer, `_updateWatchers(photoId, uuid)`, which is called from `watch.ts` and `unwatch.ts` (and the delete path). `_updateWatchers` sets the column to `COUNT` of `Watchers` rows for the photo **excluding the owner** (`"Watchers"."uuid" != "Photos"."uuid"`).
- Helper files in this controller are read-only, underscore-prefixed, and each manages its own `psql.connect()` / `psql.clean()` around a single query (e.g. `_isPhotoWatched.ts`, `_getWaveInfo.ts`).
- `getPhotoDetails` is already fully wired end-to-end (`graphql/schema.graphql` → `lambda-fns/index.ts` → `lib/resources/resolvers.ts`). Adding a field to the returned object requires **no** new resolver or `index.ts` entry — only the schema type and the controller return shape change.

## Goals / Non-Goals

**Goals:**
- Add `watchersCount: Int!` to `PhotoDetails`, populated by a new **read-only** helper.
- The value counts the photo's watchers **excluding the owner**, using the same semantics as `_updateWatchers`.
- `getPhotoDetails` stays read-only and non-mutating; existing fields are untouched.
- Keep the new value equal to the feed's `Photos.watchersCount` for the same photo at the same moment.

**Non-Goals:**
- No changes to how `Photos.watchersCount` is written or maintained (no edits to `_updateWatchers`, `watch.ts`, `unwatch.ts`, or the delete path).
- No new GraphQL operation, no new resolver/index.ts/resolver-dispatch wiring (the query already exists).
- No database schema or migration changes.
- No caching, subscriptions, or client-side changes (the client already reads the field).

## Decisions

### Decision 1: Recompute from `Watchers` in a dedicated read-only helper
**Choice:** Add a new helper file `lambda-fns/controllers/photos/_getWatchersCount.ts` exporting `_getWatchersCount(photoId)`, which runs a single read-only `SELECT COUNT` over `Watchers` joined to `Photos` to exclude the owner:

```sql
SELECT COUNT(w.id)::int
FROM "Watchers" w
JOIN "Photos" p ON p.id = w."photoId"
WHERE w."photoId" = $1
  AND w."uuid" != p."uuid"
```

`getPhotoDetails.ts` adds `_getWatchersCount(photoId)` to the existing `Promise.all` and returns `watchersCount: watchersCount ?? 0`.

**Rationale:**
- Matches the project's underscore-helper convention and keeps `getPhotoDetails.ts` thin (a fan-out only), consistent with `_isPhotoWatched` / `_getWaveInfo`.
- Read-only: a `SELECT` with no `UPDATE`/`INSERT`/`DELETE`, so the "reading does not mutate" requirement is satisfied by construction.
- Mirrors `_updateWatchers`'s owner-exclusion exactly (`"Watchers"."uuid" != "Photos"."uuid"`), so the details count uses the same definition as the feed count.
- The `::int` cast matches the non-nullable `Int!` GraphQL type; returning `0` when there are no rows keeps the field non-null.

**Alternatives considered:**
- **Read the denormalized `Photos.watchersCount` column directly** (`SELECT "watchersCount" FROM "Photos" WHERE id = $1`). This is byte-for-byte equal to the feed value by construction (it *is* the feed value) and avoids the join. Rejected in favor of recomputing because the request explicitly calls for a read-only helper that counts watchers excluding the owner "the same way the feed count is" produced, and recomputing from `Watchers` (the source of truth) also self-corrects if the denormalized column were ever stale. See Risk 1 on the consistency trade-off.
- **Reuse `_updateWatchers`.** Rejected: it is a write (`UPDATE ... returning`) and would mutate state from a read path — explicitly out of scope.
- **Reuse `getWatchedCount`.** Rejected: it counts *a user's* bookmarked photos (the badge), a different query shape and different result.

### Decision 2: Default to `0`, not null, when there are no watchers
**Choice:** Coerce a missing row to `0` in the controller (`watchersCount ?? 0`).
**Rationale:** The schema field is `Int!` (non-nullable). AppSync would turn a `null` into a `Cannot return null for non-nullable type` error, so the controller must guarantee a number. This matches how the feed surfaces a zero count.

### Decision 3: No wiring changes
**Choice:** Do not touch `lambda-fns/index.ts` or `lib/resources/resolvers.ts`.
**Rationale:** `getPhotoDetails` is an existing `Query` field already dispatched to this controller. Adding a field to the object it returns is a schema-type + return-shape change only; a new resolver entry would be incorrect (there is no new operation). This is the opposite of the "wire in four places" rule, which applies to *new* operations.

## Risks / Trade-offs

- [Risk] The recomputed value could differ from the denormalized `Photos.watchersCount` column if that column were ever stale (out of sync with `Watchers`) → [Mitigation] `_updateWatchers` is the single writer and runs on every `watch`/`unwatch` (and the delete path), so in steady state the two agree; the consistency requirement is defined for the "same moment" steady state. If a perfect match with the feed column is ever preferred over reflecting `Watchers`, the helper can be switched to read the column directly (Decision 1 alternative) with no other change.
- [Risk] One extra query per `getPhotoDetails` call → [Mitigation] It runs in the existing `Promise.all` (no added round-trips/latency serially), and the `Watchers` rows for a single photo are indexed by `photoId`, so the count is cheap.
- [Risk] Owner-exclusion depends on `Photos.id` matching `Watchers."photoId"` and on the owner being present in `Photos` for the join → [Mitigation] The join is on the same key the feed and `_updateWatchers` use; if the photo row is absent the join yields zero rows and the count is `0`, consistent with the existing (non-existence-checking) behavior of the other detail helpers.

## Migration Plan

1. Add `watchersCount: Int!` to `type PhotoDetails` in `graphql/schema.graphql` (additive schema change — deployable, no backfill).
2. Add `_getWatchersCount.ts` and wire it into `getPhotoDetails.ts` (`Promise.all` + return object).
3. No DB migration, no data backfill, no client change required.
4. Rollback: revert the schema field and the controller return; the helper file is unused and can be removed. No state was mutated, so there is nothing to clean up.

## Open Questions

None. The remaining choice (recompute-from-`Watchers` vs. read-the-column) is resolved in Decision 1 with a documented, reversible alternative.
