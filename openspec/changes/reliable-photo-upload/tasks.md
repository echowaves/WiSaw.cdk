## 1. Add getPhotoById query handler (device-authenticated)

- [x] 1.1 Create `lambda-fns/controllers/photos/getPhotoById.ts` controller
- [x] 1.2 Controller accepts `photoId: string` and `uuid: string`, validates both with `assertValidUuid`
- [x] 1.3 Query `SELECT * FROM "Photos" WHERE "id" = $1 AND "uuid" = $2` with both parameters
- [x] 1.4 Return `Photo` via `plainToClass` or `null` if not found (including mismatched device)
- [x] 1.5 Register handler in `lambda-fns/index.ts` queryHandlers map with `getArgs: (args) => [args.photoId, args.uuid]`
- [x] 1.6 Register resolver in `lib/resources/resolvers.ts`
- [x] 1.7 Add `getPhotoById(photoId: String!, uuid: String!): Photo!` to GraphQL schema `graphql/schema.graphql` under Query type

## 2. Modify createPhoto to accept required photoId

- [x] 2.1 Add `photoId: string` parameter to `createPhoto` function signature (required)
- [x] 2.2 Validate `photoId` with `assertValidUuid`
- [x] 2.3 Remove auto-generated `const photoId = uuidv4()` — use the passed `photoId` directly
- [x] 2.4 Wrap INSERT in try/catch to handle UNIQUE constraint violation (error code 23505)
- [x] 2.5 On UNIQUE violation, query for existing photo and return it (idempotent)
- [x] 2.6 Update `graphql/schema.graphql` to add required `photoId: String!` to createPhoto mutation

## 3. Update controller dispatch and resolvers

- [x] 3.1 Add `getPhotoById` to `mutationHandlers` or `queryHandlers` in `lambda-fns/index.ts`
- [x] 3.2 Add resolver registration in `lib/resources/resolvers.ts` if not handled by index.ts
- [x] 3.3 Verify handler args extraction: `getArgs: (args) => [args.photoId, args.uuid]`

## 4. Testing

- [ ] 4.1 Test `getPhotoById` with existing photo ID — returns Photo
- [ ] 4.2 Test `getPhotoById` with non-existing photo ID — returns null
- [ ] 4.3 Test `createPhoto` with `photoId` — creates photo with provided ID
- [ ] 4.4 Test `createPhoto` with new `photoId` — creates photo with provided ID
- [ ] 4.5 Test `createPhoto` with existing `photoId` — returns existing photo (idempotent)
- [ ] 4.6 Test concurrent `createPhoto` with same `photoId` — only one succeeds, other returns existing
- [ ] 4.7 Test `createPhoto` with banned user and existing `photoId` — returns existing photo (skip abuse check)
- [ ] 4.8 Verify no database schema changes required

## 5. GraphQL Schema Updates (merged with sections 1 & 2)

- [x] 5.1 `getPhotoById(photoId: String!, uuid: String!): Photo!` added to Query type (done in 1.7)
- [x] 5.2 `photoId: String!` added as required parameter to `createPhoto` mutation (done in 2.6)
- [x] 5.3 Verified: `npx tsc --noEmit` passes, `npx cdk synth` succeeds
