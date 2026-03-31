## 1. GraphQL Schema

- [x] 1.1 Add `getWatchedCount(uuid: String!): Int!` query to `graphql/schema.graphql`

## 2. Controller

- [x] 2.1 Create `lambda-fns/controllers/photos/getWatchedCount.ts` with COUNT query joining Watchers and Photos (active=true), using `assertValidUuid` for input validation

## 3. Lambda Dispatch

- [x] 3.1 Import `getWatchedCount` and add handler entry in `lambda-fns/index.ts`

## 4. CDK Resolver

- [x] 4.1 Add `{ typeName: 'Query', fieldName: 'getWatchedCount' }` resolver mapping in `lib/resources/resolvers.ts`
