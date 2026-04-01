## 1. Database Migration

- [x] 1.1 Create migration file to drop `Messages`, `ChatPhotos`, `ChatUsers`, `Chats` tables (in dependency order) and remove `chatUuid` column from `Friendships`

## 2. Remove Chat Controllers and Models

- [x] 2.1 Delete `lambda-fns/controllers/messages/` directory (generateUploadUrlForMessage.ts, send.ts, getMessagesList.ts, resetUnreadCount.ts)
- [x] 2.2 Delete `lambda-fns/controllers/friendships/getUnreadCountsList.ts`
- [x] 2.3 Delete `lambda-fns/models/chat.ts`, `lambda-fns/models/chatUser.ts`, `lambda-fns/models/message.ts`

## 3. Remove Private Image Processing Lambdas

- [x] 3.1 Delete `lambda-fns/lambdas/processUploadedPrivateImage/` directory
- [x] 3.2 Delete `lambda-fns/lambdas/processDeletedPrivateImage/` directory

## 4. Update GraphQL Schema

- [x] 4.1 Remove `Chat`, `ChatUser`, `UnreadCount`, `Message`, `UploadUrlForMessage`, `CreateFriendshipResult` types from `graphql/schema.graphql`
- [x] 4.2 Remove `chatUuid` field from `Friendship` type
- [x] 4.3 Remove queries `generateUploadUrlForMessage`, `getMessagesList`, `getUnreadCountsList`
- [x] 4.4 Remove mutations `sendMessage`, `resetUnreadCount`
- [x] 4.5 Remove subscription `onSendMessage`
- [x] 4.6 Change `createFriendship` return type from `CreateFriendshipResult!` to `Friendship!`
- [x] 4.7 Change `acceptFriendshipRequest` return type from `CreateFriendshipResult!` to `Friendship!`

## 5. Simplify Friendship Controllers

- [x] 5.1 Modify `lambda-fns/controllers/friendships/createFriendship.ts` — remove Chat/ChatUser creation, remove transaction, return Friendship instead of CreateFriendshipResult
- [x] 5.2 Modify `lambda-fns/controllers/friendships/acceptFriendshipRequest.ts` — remove ChatUser insertion, return Friendship instead of CreateFriendshipResult
- [x] 5.3 Modify `lambda-fns/controllers/friendships/delete.ts` — remove cascade deletes for Chats/ChatUsers/Messages

## 6. Update Friendship Model

- [x] 6.1 Remove `chatUuid` field from `lambda-fns/models/friendship.ts`

## 7. Update Lambda Dispatcher

- [x] 7.1 Remove chat/message imports and handler entries from `lambda-fns/index.ts` (generateUploadUrlForMessage, getMessagesList, getUnreadCountsList, sendMessage, resetUnreadCount)
- [x] 7.2 Remove chat-related fields from `AppSyncEvent` interface in `lambda-fns/index.ts`

## 8. Update CDK Resources

- [x] 8.1 Remove resolver mappings for chat operations from `lib/resources/resolvers.ts` (generateUploadUrlForMessage, getUnreadCountsList, getMessagesList, sendMessage, resetUnreadCount)
- [x] 8.2 Remove `processUploadedPrivateImage` and `processDeletedPrivateImage` Lambda definitions from `lib/resources/lambdas.ts`
- [x] 8.3 Remove `imgPrivateBucket` definition, event notifications, and IAM grants from `lib/resources/buckets.ts`

## 9. Remove Chat Spec

- [x] 9.1 Delete `openspec/specs/chat-messages/` directory
