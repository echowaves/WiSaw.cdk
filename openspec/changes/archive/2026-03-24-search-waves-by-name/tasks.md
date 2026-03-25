## 1. GraphQL Schema

- [x] 1.1 Add `searchTerm: String` optional parameter to `listWaves` query in `graphql/schema.graphql`

## 2. Controller

- [x] 2.1 Add `name` to `ALLOWED_SORT_FIELDS` whitelist in `lambda-fns/controllers/waves/listWaves.ts`
- [x] 2.2 Add `searchTerm` parameter to controller function signature and conditionally append `ILIKE` clause to SQL query with parameterized `$2`

## 3. Resolver Dispatch

- [x] 3.1 Pass `searchTerm` argument through resolver dispatch in `lambda-fns/index.ts` and add field to `AppSyncEvent` interface
