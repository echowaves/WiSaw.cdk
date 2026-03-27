## 1. Validation Utility

- [x] 1.1 Create `lambda-fns/utilities/isValidDeviceUuid.ts` with UUID regex validation (same pattern as `isValidPhotoId`)

## 2. Photos Feed Controllers

- [x] 2.1 Convert `lambda-fns/controllers/photos/feedForWatcher.ts` to parameterized queries and add `isValidDeviceUuid` validation on `uuid`
- [x] 2.2 Convert `lambda-fns/controllers/photos/feedByDate.ts` to parameterized queries for `lon`, `lat`, date boundaries, `daysAgo`, `limit`, `offset`
- [x] 2.3 Convert `lambda-fns/controllers/photos/feedForTextSearch.ts` to parameterized queries for `searchTerm`, `limit`, `offset`
- [x] 2.4 Convert `lambda-fns/controllers/photos/feedRecent.ts` to parameterized queries for `limit`, `offset`

## 3. Contact Forms Controller

- [x] 3.1 Convert `lambda-fns/controllers/contactForms/create.ts` to parameterized queries and add `isValidDeviceUuid` validation on `uuid`

## 4. Friendships Controllers

- [x] 4.1 Convert `lambda-fns/controllers/friendships/createFriendship.ts` to parameterized queries
- [x] 4.2 Convert `lambda-fns/controllers/friendships/acceptFriendshipRequest.ts` to parameterized queries
- [x] 4.3 Convert `lambda-fns/controllers/friendships/delete.ts` to parameterized queries
- [x] 4.4 Convert `lambda-fns/controllers/friendships/getFriendshipsList.ts` to parameterized queries and add `isValidDeviceUuid` validation
- [x] 4.5 Convert `lambda-fns/controllers/friendships/getUnreadCountsList.ts` to parameterized queries and add `isValidDeviceUuid` validation

## 5. Messages Controllers

- [x] 5.1 Convert `lambda-fns/controllers/messages/send.ts` to parameterized queries
- [x] 5.2 Convert `lambda-fns/controllers/messages/getMessagesList.ts` to parameterized queries
- [x] 5.3 Convert `lambda-fns/controllers/messages/resetUnreadCount.ts` to parameterized queries
- [x] 5.4 Convert `lambda-fns/controllers/messages/generateUploadUrlForMessage.ts` to parameterized queries

## 6. Secrets Controllers

- [x] 6.1 Convert `lambda-fns/controllers/secrets/register.ts` to parameterized queries
- [x] 6.2 Convert `lambda-fns/controllers/secrets/update.ts` to parameterized queries
