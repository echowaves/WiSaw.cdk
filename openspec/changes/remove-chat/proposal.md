## Why

The chat/messaging feature is completely abandoned and will not be developed further. Removing it reduces codebase complexity, eliminates dead infrastructure costs (private S3 bucket, two Lambda processors), and simplifies the friendship system by decoupling it from chat.

## What Changes

- **BREAKING** Remove all chat/messaging GraphQL operations: `sendMessage`, `resetUnreadCount`, `getMessagesList`, `getUnreadCountsList`, `generateUploadUrlForMessage`, `onSendMessage` subscription.
- **BREAKING** Remove GraphQL types: `Chat`, `ChatUser`, `UnreadCount`, `Message`, `UploadUrlForMessage`, `CreateFriendshipResult`.
- **BREAKING** Remove `chatUuid` field from `Friendship` type.
- **BREAKING** Change `createFriendship` and `acceptFriendshipRequest` return type from `CreateFriendshipResult!` to `Friendship!`.
- Remove all message controllers (`lambda-fns/controllers/messages/`), `getUnreadCountsList` controller.
- Remove chat-related models (`chat.ts`, `chatUser.ts`, `message.ts`), remove `chatUuid` from friendship model.
- Remove private image processing lambdas (`processUploadedPrivateImage`, `processDeletedPrivateImage`).
- Remove private S3 bucket CDK resources (`imgPrivateBucket`, event notifications, IAM grants).
- Simplify friendship controllers: `createFriendship` no longer creates Chat/ChatUser, `acceptFriendshipRequest` no longer adds ChatUser, `deleteFriendship` no longer cascades to chat tables.
- Add database migration to drop `Chats`, `ChatUsers`, `Messages`, `ChatPhotos` tables and remove `chatUuid` column from `Friendships`.
- Remove `openspec/specs/chat-messages/` spec.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities
- `friendships`: Remove chat coupling — `createFriendship` and `acceptFriendshipRequest` return `Friendship!` instead of `CreateFriendshipResult!`, `deleteFriendship` no longer cascades to chat tables, `chatUuid` is removed from the Friendship type.

## Impact

- **GraphQL schema**: 6 operations removed, 5 types removed, 2 mutation return types changed, 1 field removed from Friendship.
- **Lambda controllers**: Entire `messages/` directory deleted (4 files), `getUnreadCountsList.ts` deleted, 3 friendship controllers simplified.
- **Models**: 3 model files deleted, 1 model modified.
- **CDK infrastructure**: 2 Lambda functions removed, private S3 bucket removed, resolver mappings removed.
- **Database**: Migration to drop 4 tables and 1 column.
- **Clients**: Any client using chat/messaging operations will break. This is intentional — the feature is abandoned.
