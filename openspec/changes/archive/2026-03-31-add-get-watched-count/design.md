## Context

The app tracks which photos a user watches via the `Watchers` table (columns: `id`, `photoId`, `uuid`, `createdAt`, `updatedAt`, `watchedAt`). The `uuid` column is indexed. The existing `feedForWatcher` query returns a paginated list of watched photos (joining with `Photos` where `active = true`), but there is no lightweight way to retrieve just the count.

Two existing count queries — `getWavesCount` and `getUngroupedPhotosCount` — establish the pattern: a GraphQL query accepting `uuid`, running a `COUNT(*)::int` SQL query, and returning `Int!`.

## Goals / Non-Goals

**Goals:**
- Provide a single-query way to get the number of active photos watched by a user.
- Follow established count-query patterns for consistency.

**Non-Goals:**
- Denormalizing the count into a user-level column (not needed given index performance).
- Changing the existing watch/unwatch mutations or `feedForWatcher` query.

## Decisions

**1. Join with Photos to filter active only**
The query joins `Watchers` with `Photos` and filters `active = true`, matching `feedForWatcher` behavior. Alternative: count only from `Watchers` table (faster index-only scan but could include deactivated photos, producing a misleading count).

**2. Place controller in `controllers/photos/`**
Watch-related controllers (`watch.ts`, `unwatch.ts`, `feedForWatcher.ts`) all live under `controllers/photos/`. This follows that convention. Alternative: a new `controllers/watchers/` directory — rejected as inconsistent with existing layout.

**3. Return `Int!` (non-nullable)**
Matches `getWavesCount` and `getUngroupedPhotosCount`. A user with no watched photos returns `0`.

## Risks / Trade-offs

- **[Stale watcher records]** → The join with `Photos.active = true` mitigates this; orphaned watcher rows for deleted photos won't inflate the count.
- **[Performance at scale]** → The `Watchers.uuid` index makes this a fast indexed join. No concern at current data volumes.
