## 1. GraphQL Schema

- [ ] 1.1 Add `getWave(waveUuid: String!, uuid: String!): Wave` to `type Query` in `graphql/schema.graphql`

## 2. Controller

- [ ] 2.1 Create `lambda-fns/controllers/waves/getWave.ts` — fetch wave by UUID, look up caller's role, fetch up to 5 recent active photos, compute `isFrozen` and `joinUrl`, return `Wave` or `null`

## 3. Dispatcher & Resolver Wiring

- [ ] 3.1 Import `getWave` and add it to `queryHandlers` in `lambda-fns/index.ts`
- [ ] 3.2 Add `{ typeName: 'Query', fieldName: 'getWave' }` to the resolver fields array in `lib/resources/resolvers.ts`

## 4. Verification

- [ ] 4.1 Confirm `getWave` appears in all four files (schema, controller, dispatcher, resolvers) and field names match exactly
