# Change: Fix Photo lastComment Missing from Model

## Problem

The `Photo` model class (`lambda-fns/models/photo.ts`) does not declare the `lastComment` property. When `plainToClass(Photo, row)` is used to transform database rows, `class-transformer` silently strips any property not declared on the target class.

This causes `lastComment` to always be `undefined` in API responses, even though:
- The `Photos` table has the `lastComment` column (migration `20210803200000-photo-last-comment.js`)
- The `_updateLastComment` helper writes to it on comment create/delete
- The GraphQL schema declares `lastComment: String!` on the `Photo` type
- SQL queries select `Photos.*` which includes it

## Impact

- **Wave cards**: Photos on wave list cards cannot sort by `lastComment`, so they don't reorder when comments arrive
- **Photo feeds**: Same sorting issue on all feed pages
- **Client-side sort fallback**: Sort logic falls back to `updatedAt` only, losing the intended ordering

## Root Cause

`class-transformer` is a shape-matching library. It copies only properties that exist on the target class definition. Any extra columns in the DB row are discarded.

```
DB Row → plainToClass(Photo, row) → { lastComment: undefined } → toJSON() → lastComment stripped
```

## Solution

Add `lastComment: string | null` to the `Photo` model class. This single property declaration lets `class-transformer` copy the value from the DB row through to the JSON response.

## Scope

- **One file**: `lambda-fns/models/photo.ts`
- **One property**: `lastComment: string | null`
- **No schema changes**: GraphQL schema already declares this field
- **No query changes**: SQL already selects `Photos.*` which includes `lastComment`
