## 1. GraphQL Schema

- [x] 1.1 Add optional `sortBy: String` and `sortDirection: String` parameters to the `listWaves` query in `graphql/schema.graphql`

## 2. Controller

- [x] 2.1 Update `lambda-fns/controllers/waves/listWaves.ts` to accept `sortBy` and `sortDirection` parameters, apply defaults, validate against whitelist, and use them in the ORDER BY clause

## 3. Resolver Wiring

- [x] 3.1 Update the `listWaves` entry in `lambda-fns/index.ts` to pass `args.sortBy` and `args.sortDirection` to the controller
