## 1. Add `recentPhoto` sort to listWaves controller

- [x] 1.1 Add `recentPhoto` entry to `ALLOWED_SORT_FIELDS` in `lambda-fns/controllers/waves/listWaves.ts` using a correlated subquery: `(SELECT MAX(p."updatedAt") FROM "WavePhotos" wp JOIN "Photos" p ON p."id" = wp."photoId" WHERE wp."waveUuid" = "Waves"."waveUuid")`
- [x] 1.2 Verify existing `ALLOWED_DIRECTIONS` whitelist already supports the needed sort directions (asc/desc)
- [x] 1.3 Verify the photos preview query is not affected by the new sort field
- [x] 1.4 Fix SQL syntax: separate column sorts from expression sorts to avoid `ORDER BY "Waves".(SELECT ...)`
- [x] 1.5 Fix empty string sortBy handling: use `sortBy && sortBy.trim() !== ''` to fall back to default

## 2. Add `recentPhoto` sort to getFriendshipsList controller

- [x] 2.1 Add `sortBy` and `sortDirection` optional parameters to the `main` function signature in `lambda-fns/controllers/friendships/getFriendshipsList.ts`
- [x] 2.2 Add `ALLOWED_SORT_FIELDS` and `ALLOWED_DIRECTIONS` whitelists to `getFriendshipsList.ts` (mirroring the pattern in `listWaves.ts`)
- [x] 2.3 Validate `sortBy` and `sortDirection` against whitelists before executing SQL
- [x] 2.4 Modify the friendships query to use `DISTINCT ON` with the appropriate ORDER BY clause based on the sort parameters:
  - Default (no sortBy): `ORDER BY LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2), "createdAt" DESC`
  - `recentPhoto` desc: `ORDER BY (SELECT MAX(p."updatedAt") FROM "Photos" p WHERE p."uuid" = LEAST(f.uuid1, f.uuid2) OR p."uuid" = GREATEST(f.uuid1, f.uuid2)) DESC, "createdAt" DESC`
  - `recentPhoto` asc: same subquery with ASC
- [x] 2.5 Ensure the subquery correctly identifies the friend UUID (the non-self UUID from each friendship record)

## 3. Update GraphQL schema

- [x] 3.1 Add `sortBy: String` and `sortDirection: String` optional parameters to the `getFriendshipsList` query in `graphql/schema.graphql`

## 4. Update Lambda query dispatcher

- [x] 4.1 Update the `AppSyncEvent['arguments']` interface in `lambda-fns/index.ts` to include `sortBy` and `sortDirection` (already present)
- [x] 4.2 Update the `getFriendshipsList` query handler in `queryHandlers` to pass `sortBy` and `sortDirection` arguments to the controller

## 5. Verify and test

- [x] 5.1 Run TypeScript compilation (`npx tsc --noEmit`) to check for type errors
- [x] 5.2 Run linter (`npm run lint`) to check for style issues
