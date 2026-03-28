## Why

`getPhotoAllNext` and `getPhotoAllPrev` use hardcoded fallback values (`'0'` and `'2147483640'`) when no next/previous photo exists. These were valid integer IDs before the UUID migration but now cause PostgreSQL errors: `invalid input syntax for type uuid: "0"`. This is actively producing errors in production.

## What Changes

- Return early with null/empty results when no next or previous photo exists, instead of passing invalid fallback values to downstream queries
- Remove the hardcoded `'0'` fallback in `getPhotoAllNext.ts`
- Remove the hardcoded `'2147483640'` fallback in `getPhotoAllPrev.ts`

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `photo-feed`: Adding requirement for photo navigation boundary handling (what happens when there's no next/prev photo)

## Impact

- **Code**: `lambda-fns/controllers/photos/getPhotoAllNext.ts`, `lambda-fns/controllers/photos/getPhotoAllPrev.ts`
- **APIs**: `getPhotoAllNext` and `getPhotoAllPrev` queries will return `{ photo: null, comments: [], recognitions: [] }` at feed boundaries instead of crashing
- **Risk**: Low — clients already handle nullable `photo` field per the GraphQL schema (`photo: Photo` is nullable in `PhotoAll` type)
