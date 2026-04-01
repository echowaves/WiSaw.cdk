## Context

The chat/messaging feature was built in 2021-2022 and is tightly coupled with friendships: every friendship creates a dedicated Chat + ChatUser, and friendship deletion cascades to Chats/ChatUsers/Messages. The feature uses a private S3 bucket (`wisaw-img-private-*`) with two Lambda processors for chat photo handling. All of this is now dead code — the feature is abandoned.

## Goals / Non-Goals

**Goals:**
- Remove all chat/messaging code, types, and infrastructure.
- Decouple friendships from chat — friendships become standalone.
- Drop chat database tables via migration.
- Remove the private S3 bucket from CDK (manual deletion of actual bucket if needed).

**Non-Goals:**
- Preserving chat data or providing a migration path for existing messages.
- Removing the old chat-related migration files (they stay for DB history).
- Deleting the actual S3 bucket from AWS (done manually if necessary).

## Decisions

**1. Migration drops tables rather than leaving them**
Dropping `Chats`, `ChatUsers`, `Messages`, `ChatPhotos` tables and removing `Friendships.chatUuid` column cleanly. The migration's `down` function will be a no-op since this is irreversible by design. Alternative: leave tables in place — rejected because it leaves confusing dead schema in the database.

**2. Return type simplification for friendship mutations**
`createFriendship` and `acceptFriendshipRequest` return `Friendship!` directly instead of the `CreateFriendshipResult!` wrapper (which included `chat` and `chatUser`). The wrapper type is deleted entirely.

**3. Friendship creation simplified to single INSERT**
Without chat, `createFriendship` just inserts a `Friendships` row (no transaction needed). `acceptFriendshipRequest` just updates `uuid2` on the friendship. `deleteFriendship` just deletes the friendship row.

**4. Private S3 bucket removed from CDK only**
The CDK resource definition, event notifications, IAM grants, and both Lambda processor functions are removed. The actual AWS bucket is left for manual cleanup to avoid accidental data loss during deployment.

## Risks / Trade-offs

- **[Breaking change for clients]** → Intentional. Any client still referencing chat operations will get schema errors. The feature is abandoned.
- **[Irreversible migration]** → The `down` migration is a no-op. Chat data cannot be recovered after migration runs. This is accepted since the feature is permanently abandoned.
- **[CDK deployment removes Lambda functions]** → The two private image processing Lambdas will be destroyed on deploy. S3 event notifications will also be removed. If the bucket still has events pending, they'll be lost — acceptable for abandoned feature.
