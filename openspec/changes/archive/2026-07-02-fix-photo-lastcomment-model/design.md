# Design: Fix Photo lastComment Missing from Model

## Context

The `Photo` model class is a shape descriptor used by `class-transformer` to map raw database rows into typed objects. It is used by every photo-returning controller:

- `listWaves` — wave card photos
- `feedByDate` — date-based feed
- `feedForWatcher` — watcher feed  
- `fetchPaginatedPhotos` (utility) — used by `feedForWave`, `feedForFriend`, etc.
- `getPhoto`, `create`, `getFriendshipsList`, etc.

When `plainToClass(Photo, row)` runs, `class-transformer` reads the `Photo` class definition and copies only the declared properties from `row` into the new instance.

## Current State

```typescript
class Photo {
  id: string
  uuid: string
  location: object
  commentsCount: bigint
  watchersCount: bigint
  createdAt: string
  updatedAt: string
  active: boolean
  video: boolean
  width?: number
  height?: number
  locality: string | null
  district: string | null
  region: string | null
  country: string | null
  countryCode: string | null
  // lastComment is MISSING here
  public toJSON() { ... }
}
```

## Change

Add `lastComment: string | null` after `countryCode`:

```typescript
class Photo {
  // ... existing properties ...
  countryCode: string | null
  lastComment: string | null
  public toJSON() { ... }
}
```

## Why `string | null`?

The GraphQL schema declares `lastComment: String!` (non-null). The database column is `NOT NULL` with a default empty string `''`. However, TypeScript's type system doesn't enforce this at the model level, and `string | null` is the safer TypeScript type — it covers the case where the DB row has `NULL` (e.g., in edge cases or during migrations) without breaking `class-transformer`'s behavior.

The `!` in GraphQL is satisfied because the DB column always has a value (default `''`), so the value will never actually be `null` in practice.

## No Other Changes Needed

- **GraphQL schema**: Already has `lastComment: String!` on the `Photo` type
- **SQL queries**: Already select `Photos.*` which includes `lastComment`
- **Controllers**: All use `plainToClass(Photo, row)` — no changes needed
- **`toJSON()` method**: Does not need modification — it only computes `imgUrl`, `thumbUrl`, `videoUrl`; the spread `...this` already includes all instance properties
