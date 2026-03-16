## 1. Add feedForWave Controller

- [x] 1.1 Create `lambda-fns/controllers/photos/feedForWave.ts` modeled after `feedForWatcher.ts` — JOIN `WavePhotos` instead of `Watchers`, filter by `waveUuid` using parameterized query (`$1`), validate `waveUuid` with `uuid` library
- [x] 1.2 Import `feedForWave` in `lambda-fns/index.ts` and add it to `queryHandlers` with `getArgs: (args) => [args.waveUuid, args.pageNumber, args.batch]`

## 2. Update GraphQL Schema

- [x] 2.1 Add `feedForWave(waveUuid: String!, pageNumber: Int!, batch: String!): PhotoFeed` query to `graphql/schema.graphql`
- [x] 2.2 Remove `waveUuid: String` parameter from `feedByDate`, `feedForWatcher`, `feedRecent`, and `feedForTextSearch` in `graphql/schema.graphql`

## 3. Add CDK Resolver Mapping

- [x] 3.1 Add the `feedForWave` resolver mapping in the CDK stack (follow the pattern used by existing feed queries)

## 4. Remove Wave Filtering from Existing Controllers

- [x] 4.1 Remove `waveUuid` parameter and conditional `JOIN "WavePhotos"` / `AND waveUuid` logic from `lambda-fns/controllers/photos/feedByDate.ts`
- [x] 4.2 Remove `waveUuid` parameter and conditional `JOIN "WavePhotos"` / `AND waveUuid` logic from `lambda-fns/controllers/photos/feedRecent.ts`
- [x] 4.3 Remove `waveUuid` parameter and conditional `JOIN "WavePhotos"` / `AND waveUuid` logic from `lambda-fns/controllers/photos/feedForWatcher.ts`
- [x] 4.4 Remove `waveUuid` parameter and conditional `JOIN "WavePhotos"` / `AND waveUuid` logic from `lambda-fns/controllers/photos/feedForTextSearch.ts`

## 5. Update index.ts Resolver Mappings

- [x] 5.1 Remove `args.waveUuid` from `getArgs` for `feedByDate`, `feedForWatcher`, `feedRecent`, and `feedForTextSearch` in `lambda-fns/index.ts`

## 6. Verification

- [x] 6.1 Confirm all modified files compile without TypeScript errors
