## 1. Create shared utility

- [x] 1.1 Create `lambda-fns/utilities/paginatedPhotos.ts` with `fetchPaginatedPhotos()` function
- [x] 1.2 Utility accepts `{ query, params, pageNumber, batchSize?, noMoreDataOverride? }`, returns `{ photos, noMoreData, nextPage }`
- [x] 1.3 Utility uses `try/finally` to ensure `psql.clean()` runs on success or error
- [x] 1.4 Utility maps results via `plainToClass(Photo, row)` and computes `noMoreData` from `photos.length < batchSize`
- [x] 1.5 Utility computes `nextPage = noMoreData ? null : pageNumber + 1`

## 2. Refactor feed controllers

- [x] 2.1 Refactor `feedForWave.ts` — replace boilerplate with utility call, keep sort config and SQL
- [x] 2.2 Refactor `feedForWatcher.ts` — replace boilerplate with utility call
- [x] 2.3 Refactor `feedForUngrouped.ts` — replace boilerplate with utility call
- [x] 2.4 Refactor `feedRecent.ts` — replace boilerplate with utility call, pass `batchSize: 20`
- [x] 2.5 Refactor `feedForFriend.ts` — replace boilerplate with utility call, keep sort config and SQL

## 3. Refactor feedForTextSearch (non-breaking)

- [x] 3.1 Refactor `feedForTextSearch.ts` — replace boilerplate with utility call, pass `noMoreDataOverride: true`
- [x] 3.2 Remove hardcoded `noMoreData: true` and `nextPage: null` — utility overrides them instead
- [x] 3.3 Remove `try/catch` wrapper — utility handles connection cleanup

## 4. Remove dead SQL

- [x] 4.1 Remove `row_number() OVER (...) + offset as row_number` from feedForWave query
- [x] 4.2 Remove `row_number() OVER (...) + offset as row_number` from feedForWatcher query
- [x] 4.3 Remove `row_number() OVER (...) + inline_offset as row_number` from feedForUngrouped query
- [x] 4.4 Remove `row_number() OVER (...) + inline_offset as row_number` from feedForFriend query
- [x] 4.5 Remove `row_number() OVER (...) + offset as row_number` from feedForTextSearch query (feedRecent has no row_number)

## 5. Fix parameterized queries

- [x] 5.1 Make `LIMIT` and `OFFSET` parameterized in feedForWave (currently `LIMIT ${limit} OFFSET ${offset}` inline)
- [x] 5.2 Make `LIMIT` and `OFFSET` parameterized in feedForUngrouped (currently `LIMIT $2 OFFSET ${offset}` inline)
- [x] 5.3 Make `LIMIT` and `OFFSET` parameterized in feedForFriend (currently `LIMIT ${limit} OFFSET ${offset}` inline)
- [x] 5.4 Parameterized `feedForWatcher` is already correct — verify no changes needed

## 6. Update specs and verify

- [x] 6.1 Update `openspec/specs/photo-feed/spec.md` — remove `feedForTextSearch currently behaves as single-page` requirement (no longer a requirement, utility preserves behavior)
- [x] 6.2 Run TypeScript compiler to verify no type errors
- [x] 6.3 Verify all 6 feed controllers still appear in `lambda-fns/index.ts` queryHandlers
- [x] 6.4 Verify all 6 feed field names still appear in `lib/resources/resolvers.ts`
