## Why

The friends list screen currently shows no indication of a friend's activity level. Adding a photo count to the Friendship type allows the frontend to display how many photos each friend has shared, improving the social experience by giving users quick insight into their friends' activity.

## What Changes

- Add `photosCount: Int` field to the `Friendship` GraphQL type
- Update the Lambda resolver for `getFriendshipsList` to compute and return the photo count for each friend by querying the Photo table

## Capabilities

### New Capabilities
- `friend-photo-count`: Expose the total number of photos a friend has uploaded via the Friendship GraphQL type

### Modified Capabilities
- `friendships`: The `Friendship` type gains a new field `photosCount: Int`

## Impact

- **GraphQL Schema**: `graphql/schema.graphql` — new field on `Friendship` type
- **Lambda Resolver**: `lambda-fns/` — resolver for `getFriendshipsList` needs to compute photo counts
- **Frontend**: `src/screens/` or `app/` — friend list UI can display the count (out of scope for backend change)
- **Database**: No schema changes — photo count is computed at query time by scanning the Photo DynamoDB table