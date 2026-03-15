## 1. GraphQL Schema

- [x] 1.1 Add `getUngroupedPhotosCount(uuid: String!): Int!` query to `graphql/schema.graphql`

## 2. Controller

- [x] 2.1 Create `lambda-fns/controllers/waves/getUngroupedPhotosCount.ts` with COUNT query using LEFT JOIN on WavePhotos

## 3. Resolver Registration

- [x] 3.1 Import `getUngroupedPhotosCount` and register it in `queryHandlers` in `lambda-fns/index.ts`
