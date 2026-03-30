## 1. GraphQL Schema

- [x] 1.1 Add `nextPage: Int` field to `PhotoFeed` type in `graphql/schema.graphql`

## 2. Feed Controllers — add nextPage to return values

- [x] 2.1 Update `feedRecent.ts` to return `nextPage: pageNumber + 1` (or `null` when `noMoreData`)
- [x] 2.2 Update `feedForWatcher.ts` to return `nextPage: pageNumber + 1` (or `null` when `noMoreData`)
- [x] 2.3 Update `feedForWave.ts` to return `nextPage: pageNumber + 1` (or `null` when `noMoreData`)
- [x] 2.4 Update `feedForTextSearch.ts` to return `nextPage: pageNumber + 1` (or `null` when `noMoreData`)

## 3. feedByDate scan-ahead

- [x] 3.1 Update `feedByDate.ts` to add scan-ahead loop (max 10 iterations) when `searchTerm` is provided — stop on first non-empty batch or `whenToStop` reached
- [x] 3.2 Update `feedByDate.ts` to return `nextPage` (next `daysAgo` value, or `null` when `noMoreData`)

## 4. Verification

- [x] 4.1 Compile TypeScript and verify no errors
