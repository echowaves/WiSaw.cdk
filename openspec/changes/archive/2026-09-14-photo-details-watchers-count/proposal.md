## Why

The list-feed `Photo` type already exposes a per-photo `watchersCount: Int!`, but the `PhotoDetails` type returned by `getPhotoDetails` has no equivalent. The client already requests and renders `photoDetails.watchersCount` (it currently always resolves to 0 because the field does not exist), so the expanded photo card and the long-press preview modal cannot show a live "how many times this photo was bookmarked" figure. Exposing the count on `PhotoDetails`, computed the same way the feed count is, lets the details surface a consistent, up-to-date bookmark count.

## What Changes

- Add `watchersCount: Int!` to the `PhotoDetails` GraphQL type (alongside `comments`, `recognitions`, `isPhotoWatched`, `waveName`, `waveUuid`).
- Add a read-only helper in the photos controller (e.g. `_getWatchersCount(photoId)`) that counts the photo's watchers **excluding the photo owner**, mirroring the existing `_updateWatchers` semantics (`"Watchers"."uuid" != "Photos"."uuid"`). This is a pure `SELECT` and MUST NOT mutate `Watchers` or `Photos`.
- Wire the helper into `getPhotoDetails.ts`: add the count to the existing `Promise.all` and include `watchersCount` in the returned object (defaulting to `0` when there are no watchers).
- The returned value MUST equal the `Photos.watchersCount` column the feed serves for the same photo at the same moment (owner excluded), so details and feed stay consistent and both move ±1 after each watch/unwatch.

This change is additive. No existing `PhotoDetails` field (`isPhotoWatched`, `waveName`, `waveUuid`, `comments`, `recognitions`) changes behavior, and `getPhotoDetails` remains read-only.

## Capabilities

### New Capabilities
- `photo-details-watchers-count`: Expose a per-photo watcher (bookmark) count on the `PhotoDetails` GraphQL type, computed read-only from `Watchers` excluding the photo owner, consistent with the feed `Photo.watchersCount`.

### Modified Capabilities
<!-- None. This is a new, additive requirement; no existing spec's requirements change. -->

## Impact

- **GraphQL Schema**: `graphql/schema.graphql` — new `watchersCount: Int!` field on `type PhotoDetails`. No resolver wiring changes: `getPhotoDetails` is already dispatched (see `lib/resources/resolvers.ts` and `lambda-fns/index.ts`); only the returned shape gains a field.
- **Lambda Controller**: `lambda-fns/controllers/photos/` — new read-only helper `_getWatchersCount.ts` (or equivalent) plus a small update to `getPhotoDetails.ts` to call it inside the existing `Promise.all` and return the field.
- **Database**: No schema or migration changes. The count is computed at query time from the existing `Watchers` and `Photos` tables.
- **Frontend**: The client already requests and renders `photoDetails.watchersCount`; no client change is required for this backend change to take effect.
- **Consistency**: The new value is defined to equal the denormalized `Photos.watchersCount` column (owner excluded) that feeds already serve, so no separate source of truth is introduced.
