## 1. Update GraphQL Schema

- [x] 1.1 Remove `sortBy` and `sortDirection` parameters from `listWaves` query in `graphql/schema.graphql`
- [x] 1.2 Remove `sortBy` and `sortDirection` parameters from `getFriendshipsList` query in `graphql/schema.graphql`
- [x] 1.3 Remove `sortBy` and `sortDirection` parameters from `feedForWave` query in `graphql/schema.graphql`
- [x] 1.4 Remove `sortBy` and `sortDirection` parameters from `feedForFriend` query in `graphql/schema.graphql`

## 2. Update listWaves Controller

- [x] 2.1 Remove `sortBy` and `sortDirection` parameters from `main` function signature in `lambda-fns/controllers/waves/listWaves.ts`
- [x] 2.2 Remove `ALLOWED_SORT_FIELDS`, `ALLOWED_SORT_EXPRESSIONS`, and `ALLOWED_DIRECTIONS` constants
- [x] 2.3 Remove sort validation logic (whitelist checks, direction parsing)
- [x] 2.4 Replace dynamic ORDER BY with hardcoded `ORDER BY "Waves"."createdAt" DESC, "Waves"."waveUuid" ASC`

## 3. Update getFriendshipsList Controller

- [x] 3.1 Remove `sortBy` and `sortDirection` parameters from `main` function signature in `lambda-fns/controllers/friendships/getFriendshipsList.ts`
- [x] 3.2 Remove `ALLOWED_SORT_FIELDS` and `ALLOWED_DIRECTIONS` constants
- [x] 3.3 Remove sort validation logic
- [x] 3.4 Remove `recentPhoto` branch and keep only default query with `ORDER BY LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2), "createdAt" DESC`

## 4. Update feedForWave Controller

- [x] 4.1 Remove `sortBy` and `sortDirection` parameters from `main` function signature in `lambda-fns/controllers/photos/feedForWave.ts`
- [x] 4.2 Remove `ALLOWED_SORT_FIELDS` and `ALLOWED_DIRECTIONS` constants
- [x] 4.3 Remove sort validation logic
- [x] 4.4 Replace `ORDER BY p.${sortField} ${direction}` with hardcoded `ORDER BY p."updatedAt" DESC`

## 5. Update feedForFriend Controller

- [x] 5.1 Remove `sortBy` and `sortDirection` parameters from `main` function signature in `lambda-fns/controllers/friendships/feedForFriend.ts`
- [x] 5.2 Remove `ALLOWED_SORT_FIELDS` and `ALLOWED_DIRECTIONS` constants
- [x] 5.3 Remove sort validation logic
- [x] 5.4 Replace `ORDER BY p.${sortField} ${direction}` with hardcoded `ORDER BY p."updatedAt" DESC`

## 6. Update Lambda Handler Mappings

- [x] 6.1 Remove `sortBy` and `sortDirection` from `getFriendshipsList` getArgs in `lambda-fns/index.ts`
- [x] 6.2 Remove `sortBy` and `sortDirection` from `listWaves` getArgs in `lambda-fns/index.ts`
- [x] 6.3 Remove `sortBy` and `sortDirection` from `feedForWave` getArgs in `lambda-fns/index.ts`
- [x] 6.4 Remove `sortBy` and `sortDirection` from `feedForFriend` getArgs in `lambda-fns/index.ts`

## 7. Clean Up AppSyncEvent Interface

- [x] 7.1 Remove `sortBy` and `sortDirection` fields from `AppSyncEvent['arguments']` interface in `lambda-fns/index.ts`

## 8. Verify No Compile Errors

- [x] 8.1 Run `npx tsc --noEmit` — no TypeScript compilation errors
