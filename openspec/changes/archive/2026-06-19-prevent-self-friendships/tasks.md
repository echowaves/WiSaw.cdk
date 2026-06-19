## 1. Prevent Self-Friendships at Creation

- [x] 1.1 Skip - self-friendship prevention handled by `acceptFriendshipRequest` (uuid1 === uuid check)
- [x] 1.2 Update `acceptFriendshipRequest` to reject self-acceptance - add check `if (existing[0].uuid1 === uuid) throw Error("Cannot accept self-friendship")` in `lambda-fns/controllers/friendships/acceptFriendshipRequest.ts`

## 2. Filter Self-Friendships at Read Time

- [x] 2.1 Update `getFriendshipsList` to filter self-friendships - skip friendships where `uuid1 === uuid2` in `lambda-fns/controllers/friendships/getFriendshipsList.ts`
- [x] 2.2 Update `feedForFriend` to reject self-feed - add validation `if (uuid === friendUuid) throw Error("Cannot fetch feed for self")` in `lambda-fns/controllers/friendships/feedForFriend.ts`

## 3. Testing

- [ ] 3.1 Test `createFriendship` with self - verify error is thrown
- [ ] 3.2 Test `acceptFriendshipRequest` with self - verify error is thrown
- [ ] 3.3 Test `getFriendshipsList` with existing self-friendship - verify it's filtered out
- [ ] 3.4 Test `feedForFriend` with self as friendUuid - verify error is thrown
- [ ] 3.5 Test normal friendships still work correctly

## 4. Verification

- [ ] 4.1 Deploy to test environment
- [ ] 4.2 Verify no self-friendships appear in friend lists
- [ ] 4.3 Verify normal friendships still work correctly
- [ ] 4.4 Test error messages for self-friendship attempts
