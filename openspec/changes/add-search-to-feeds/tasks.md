## 1. Shared Utility

- [x] 1.1 Create `lambda-fns/utilities/searchClause.ts` with `buildSearchClause(searchTerm, paramStartIndex)` that returns `{ clause: string, params: any[] }`

## 2. GraphQL Schema

- [x] 2.1 Add `searchTerm: String` optional parameter to `feedByDate`, `feedForWatcher`, `feedForWave`, and `feedRecent` in `graphql/schema.graphql`

## 3. Dispatcher

- [x] 3.1 Update `lambda-fns/index.ts` to pass `args.searchTerm` in `getArgs` for `feedByDate`, `feedForWatcher`, `feedForWave`, and `feedRecent`

## 4. Controllers

- [x] 4.1 Update `feedRecent.ts` to accept optional `searchTerm` and use `buildSearchClause`
- [x] 4.2 Update `feedForWatcher.ts` to accept optional `searchTerm` and use `buildSearchClause`
- [x] 4.3 Update `feedForWave.ts` to accept optional `searchTerm` and use `buildSearchClause`
- [x] 4.4 Update `feedByDate.ts` to accept optional `searchTerm`, pass to `_retrievePhotos`, and use `buildSearchClause`
- [x] 4.5 Refactor `feedForTextSearch.ts` to use `buildSearchClause` utility instead of inline SQL
