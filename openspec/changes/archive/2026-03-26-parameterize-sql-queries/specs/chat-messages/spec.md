## MODIFIED Requirements

### Requirement: Send a message to a chat
The system SHALL allow a ChatUser to send a message into a Chat using an upsert pattern that supports optimistic UI. All SQL queries SHALL use parameterized SQL.

#### Scenario: New message inserted
- **WHEN** `sendMessage(chatUuid, uuid, messageUuid, text, pending, chatPhotoHash)` is called and no message with that `messageUuid` exists
- **THEN** a new Message record is inserted using parameterized SQL and the saved Message is returned

#### Scenario: Pending message confirmed (upsert)
- **WHEN** `sendMessage` is called with a `messageUuid` that already exists (from a prior optimistic insert)
- **THEN** the existing Message record is updated with the provided `text`, `pending`, and `chatPhotoHash` values; the updated Message is returned

#### Scenario: Duplicate message detection
- **WHEN** more than one Message record with the same `messageUuid` is found
- **THEN** the system throws an error indicating potential duplication and no changes are made

#### Scenario: Input UUIDs validated
- **WHEN** `sendMessage` is called with any of `chatUuid`, `uuid`, or `messageUuid` not in valid UUID format
- **THEN** the system throws a validation error

---

### Requirement: List messages for a chat
The system SHALL return all messages for a given chat created after a specified timestamp. All SQL queries SHALL use parameterized SQL.

#### Scenario: Message history retrieved
- **WHEN** `getMessagesList(chatUuid, lastLoaded)` is called
- **THEN** all Message records for that `chatUuid` with `createdAt > lastLoaded` are returned in ascending creation order using parameterized SQL

---

### Requirement: Track unread message counts per chat
The system SHALL maintain an unread count per chat per user, incremented on send and query-able at any time. All SQL queries SHALL use parameterized SQL.

#### Scenario: Unread counts retrieved
- **WHEN** `getUnreadCountsList(uuid)` is called with a valid device `uuid`
- **THEN** the system returns `UnreadCount` records for every Chat the device participates in, showing the number of unread messages

---

### Requirement: Reset unread count for a chat
The system SHALL allow a user to mark all messages in a chat as read by resetting their unread count. All SQL queries SHALL use parameterized SQL.

#### Scenario: Unread count reset
- **WHEN** `resetUnreadCount(chatUuid, uuid)` is called
- **THEN** the unread count for that `chatUuid` / `uuid` combination is set to 0 and the current datetime is returned

---

### Requirement: Generate presigned upload URL for message image
The system SHALL generate a presigned S3 upload URL for a message image. The controller SHALL validate that the `chatPhotoHash` is not already associated with an existing message using parameterized SQL.

#### Scenario: Upload URL generated
- **WHEN** `generateUploadUrlForMessage(chatPhotoHash)` is called
- **THEN** the system checks for existing messages with that hash using parameterized SQL, then returns a presigned upload URL
