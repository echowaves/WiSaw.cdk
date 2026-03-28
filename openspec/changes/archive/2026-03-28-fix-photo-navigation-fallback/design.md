## Context

`getPhotoAllNext` and `getPhotoAllPrev` navigate between photos in the feed. When no next/previous photo exists, they fall back to hardcoded values (`'0'` / `'2147483640'`) inherited from the integer-ID era. After the UUID migration, these values cause PostgreSQL UUID parse errors.

## Goals / Non-Goals

**Goals:**
- Eliminate the invalid fallback values that crash on UUID columns
- Return a well-formed empty response at feed boundaries

**Non-Goals:**
- Changing feed ordering or navigation logic
- Modifying the GraphQL schema (the `PhotoAll` type already allows nullable `photo`)

## Decisions

**Return early when no next/prev photo exists**: When the navigation query returns no rows, return `{ photo: null, comments: [], recognitions: [] }` immediately instead of passing a fallback ID to `_getPhoto`, `_getComments`, and `_getRecognitions`. This avoids all downstream queries with invalid IDs.

Alternative considered: use a nil UUID (`00000000-0000-0000-0000-000000000000`) as the fallback. Rejected because it would still hit the database with a query that can never match, wasting a round-trip.

## Risks / Trade-offs

- **[Client behavior]** → Clients must handle `photo: null` in the response. The GraphQL schema already declares `photo: Photo` (nullable), so well-behaved clients already handle this. No breaking change.
