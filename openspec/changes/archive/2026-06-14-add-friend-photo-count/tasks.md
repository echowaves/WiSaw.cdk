## 1. Update GraphQL Schema

- [x] 1.1 Add `photosCount: Int` field to `Friendship` type in `graphql/schema.graphql`

## 2. Update Friendship Model

- [x] 2.1 Add `photosCount` property to `Friendship` class in `lambda-fns/models/friendship.ts`

## 3. Update getFriendshipsList Resolver

- [x] 3.1 Modify the photos query in `lambda-fns/controllers/friendships/getFriendshipsList.ts` to also return photo counts per friend UUID
- [x] 3.2 Map photo counts to each friendship object in the result