## 1. GraphQL Schema

- [x] 1.1 Add `watchersCount: Int!` to `type PhotoDetails` in `graphql/schema.graphql`, placed alongside `comments`, `recognitions`, `isPhotoWatched`, `waveName`, and `waveUuid`. Verify by opening the schema and confirming the field appears exactly once on `PhotoDetails` (and that `type Photo` is unchanged).

## 2. Read-only watcher-count helper

- [x] 2.1 Create `lambda-fns/controllers/photos/_getWatchersCount.ts` exporting `export const _getWatchersCount = async (photoId: string): Promise<number>` that opens a `psql` connection, runs the read-only query below, calls `psql.clean()`, and returns `result?.count ?? 0`. Verify the function contains no `UPDATE`, `INSERT`, or `DELETE` (pure `SELECT`) and that cyclomatic complexity is ≤ 8 (a single linear function).

  ```sql
  SELECT COUNT(w.id)::int AS count
  FROM "Watchers" w
  JOIN "Photos" p ON p.id = w."photoId"
  WHERE w."photoId" = $1
    AND w."uuid" != p."uuid"
  ```

  Verify the owner-exclusion predicate is exactly `w."uuid" != p."uuid"` (matching `_updateWatchers` semantics) and the count is cast `::int` to match the `Int!` type.

## 3. Wire into getPhotoDetails

- [x] 3.1 In `lambda-fns/controllers/photos/getPhotoDetails.ts`, import `_getWatchersCount` and add it to the existing `Promise.all` as `_getWatchersCount(photoId)`. Verify the destructure of the `Promise.all` result includes the new count and that the helper call uses `photoId` (no `uuid` argument — owner exclusion is resolved via the join).

- [x] 3.2 Add `watchersCount` to the object `getPhotoDetails` returns, defaulting to `0` when absent (e.g. `watchersCount: watchersCount ?? 0`). Verify the returned object now includes `watchersCount` in addition to `comments`, `recognitions`, `isPhotoWatched`, `waveName`, and `waveUuid`, and that no existing field's expression was changed.

## 4. Verify consistency and non-mutation

- [x] 4.1 Confirm `getPhotoDetails` performs no writes: re-read the final `getPhotoDetails.ts` and `_getWatchersCount.ts` and verify neither issues a write statement and that `_updateWatchers` / `getWatchedCount` are **not** called or reused.

- [x] 4.2 Verify no resolver dispatch change is required: confirm `getPhotoDetails` is already present in `lambda-fns/index.ts` (`queryHandlers`) and in `lib/resources/resolvers.ts` (`{ typeName: 'Query', fieldName: 'getPhotoDetails' }`), and that neither file was modified by this change (the new field is on the returned object, not a new operation).

- [x] 4.3 Run the type/lint checks and confirm they pass: `npx tsc --noEmit` (or the project's typecheck) and `npm run lint`. Verify no new type or lint errors are introduced by the helper or controller change.
