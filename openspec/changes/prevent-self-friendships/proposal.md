## Why

The friendship system allows users to create self-friendships (a user becoming friends with themselves), which then appear in their friend list. This is a data integrity issue - a user should not see themselves in their own friends list.

**Evidence:**
1. `createFriendship(uuid)` creates a friendship where `uuid1 = uuid` and `uuid2 = NULL`
2. `acceptFriendshipRequest(friendshipUuid, uuid)` can set `uuid2 = uuid`, creating a self-friendship
3. `getFriendshipsList(uuid)` includes self-friendships in the friend list because it extracts `friendUuid = uuid2` when `uuid1 = uuid`

## What Changes

- **BREAKING** `createFriendship(uuid)`: Reject if called with self (uuid is being used to create friendship with self)
- **BREAKING** `acceptFriendshipRequest(friendshipUuid, uuid)`: Reject if accepting a friendship where `uuid1 = uuid`
- `getFriendshipsList(uuid)`: Filter out self-friendships where `uuid1 = uuid2`
- `feedForFriend(uuid, friendUuid)`: Reject if `uuid === friendUuid`

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `friendships`: Friendship validation now prevents self-friendships at creation and filters them at read time

## Impact

**Affected Files:**
- `lambda-fns/controllers/friendships/createFriendship.ts` - Add self-friendship prevention
- `lambda-fns/controllers/friendships/acceptFriendshipRequest.ts` - Add self-friendship prevention
- `lambda-fns/controllers/friendships/getFriendshipsList.ts` - Filter self-friendships
- `lambda-fns/controllers/friendships/feedForFriend.ts` - Add self-friendship validation

**Behavior Change:**
- Before: Users could create self-friendships, which appeared in their friend list
- After: Self-friendships are prevented at creation and filtered at read time

**API Changes:**
- `createFriendship`: May throw "Cannot create friendship with self" error
- `acceptFriendshipRequest`: May throw "Cannot accept self-friendship" error
- `getFriendshipsList`: May return fewer friendships (self-friendships excluded)
- `feedForFriend`: May throw "Cannot fetch feed for self" error
