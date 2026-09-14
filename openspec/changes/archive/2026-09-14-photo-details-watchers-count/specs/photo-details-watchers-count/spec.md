## Purpose

Expose a per-photo bookmark (watcher) count on the photo-details surface so the client can show how many times a photo has been bookmarked on the expanded card and long-press preview, consistent with the feed.

## ADDED Requirements

### Requirement: PhotoDetails exposes a per-photo watcher count
The `PhotoDetails` GraphQL type SHALL include a `watchersCount` field of non-nullable type `Int` representing the number of other users who have bookmarked (watched) the photo. The field SHALL always be present in the response and SHALL be `0` — never null — when the photo has no qualifying watchers.

#### Scenario: Photo with watchers returns the count
- **WHEN** `getPhotoDetails` is called for a photo that `N` non-owner users have bookmarked
- **THEN** the response includes `watchersCount` equal to `N`

#### Scenario: Photo with no watchers returns zero
- **WHEN** `getPhotoDetails` is called for a photo that no other user has bookmarked
- **THEN** the response includes `watchersCount: 0` (the field is present and non-null)

### Requirement: Watcher count excludes the photo owner
The `watchersCount` returned on `PhotoDetails` SHALL exclude the photo's owner from the tally, matching the semantics by which the feed's `Photo.watchersCount` is maintained (a watcher whose identity equals the photo owner is not counted).

#### Scenario: Owner's own bookmark is not counted
- **WHEN** the photo's owner is recorded as a watcher of their own photo and no other user has bookmarked it
- **THEN** `getPhotoDetails` returns `watchersCount: 0`

#### Scenario: Owner plus other watchers
- **WHEN** the owner and three other users have bookmarked the photo
- **THEN** `getPhotoDetails` returns `watchersCount: 3`

### Requirement: Count is consistent with the feed
For a given photo, the `watchersCount` returned by `getPhotoDetails` SHALL equal the `watchersCount` the list feed (`Photo` type) serves for the same photo at the same moment.

#### Scenario: Details and feed agree
- **WHEN** a photo is bookmarked by five non-owner users and `getPhotoDetails` and a feed query are evaluated for that photo
- **THEN** both report `watchersCount: 5`

### Requirement: Count reflects bookmarking and unbookmarking
The `watchersCount` observed by `getPhotoDetails` SHALL increase by one when a non-owner user bookmarks the photo and decrease by one when a non-owner user removes the bookmark, as seen by a subsequent `getPhotoDetails` call.

#### Scenario: Bookmarking increments the count
- **WHEN** a user who has not bookmarked the photo bookmarks it
- **THEN** a subsequent `getPhotoDetails` returns `watchersCount` one higher than it did before the bookmark

#### Scenario: Unbookmarking decrements the count
- **WHEN** a non-owner user who had bookmarked the photo removes the bookmark
- **THEN** a subsequent `getPhotoDetails` returns `watchersCount` one lower than it did before the unbookmark

### Requirement: Reading photo details does not mutate watchers
Retrieving photo details SHALL be read-only: it SHALL NOT create, update, or delete any watcher rows and SHALL NOT alter the stored per-photo watcher count.

#### Scenario: Fetching details leaves watchers unchanged
- **WHEN** `getPhotoDetails` is called for a photo
- **THEN** the set of watcher rows and the stored per-photo watcher count are unchanged by the read
