## 1. GraphQL Schema

- [x] 1.1 Add `photos: [Photo]` field to the `Friendship` type
- [x] 1.2 Add optional `sortBy: String` and `sortDirection: String` params to `feedForWave` query
- [x] 1.3 Add `feedForFriend` query: `feedForFriend(uuid: String!, friendUuid: String!, pageNumber: Int!, batch: String!, searchTerm: String, sortBy: String, sortDirection: String): PhotoFeed`

## 2. Add sorting to feedForWave

- [x] 2.1 Modify `lambda-fns/controllers/photos/feedForWave.ts` to accept optional `sortBy` and `sortDirection` params with whitelist validation, defaulting to `updatedAt DESC`

## 3. Enhance getFriendshipsList with preview photos

- [x] 3.1 Modify `lambda-fns/controllers/friendships/getFriendshipsList.ts` to batch-load up to 5 recent active photos per confirmed friend and attach as `photos` field

## 4. Create feedForFriend

- [x] 4.1 Create `lambda-fns/controllers/friendships/feedForFriend.ts` with friendship validation, paginated photo query, search, and sorting support

## 5. Lambda Dispatch

- [x] 5.1 Update `lambda-fns/index.ts`: add new `sortBy`/`sortDirection` args to `feedForWave` handler, import and add `feedForFriend` handler

## 6. CDK Resolver

- [x] 6.1 Add `{ typeName: 'Query', fieldName: 'feedForFriend' }` resolver mapping in `lib/resources/resolvers.ts`
