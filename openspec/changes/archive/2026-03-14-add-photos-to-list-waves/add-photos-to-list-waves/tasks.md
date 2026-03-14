## 1. GraphQL Schema

- [x] 1.1 Add `photosCount: Int` field to the `Wave` type in `graphql/schema.graphql`

## 2. Wave Model

- [x] 2.1 Add `photosCount: number` property to the `Wave` class in `lambda-fns/models/wave.ts`

## 3. Controller

- [x] 3.1 Update the photos query in `lambda-fns/controllers/waves/listWaves.ts` to use `ROW_NUMBER()` and `COUNT(*)` window functions, limiting to 5 photos per wave and including total count
- [x] 3.2 Attach `photosCount` to each wave alongside the limited `photos` array
