## 1. GraphQL Schema

- [x] 1.1 Add `feedForUngrouped(uuid: String!, pageNumber: Int!, batch: String!, searchTerm: String): PhotoFeed` query to `graphql/schema.graphql`

## 2. Controller

- [x] 2.1 Create `lambda-fns/controllers/photos/feedForUngrouped.ts` — LEFT JOIN WavePhotos, IS NULL filter, scoped by device uuid, LIMIT/OFFSET pagination, optional searchTerm via buildSearchClause, returns PhotoFeed with nextPage

## 3. Wiring

- [x] 3.1 Import and register `feedForUngrouped` handler in `lambda-fns/index.ts`
- [x] 3.2 Add `feedForUngrouped` resolver entry in `lib/resources/resolvers.ts`

## 4. Verify

- [x] 4.1 Run `npx tsc --noEmit` to confirm clean TypeScript compilation
