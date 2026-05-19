## Context

The field-matching auto-grouping algorithm was implemented to replace distance-based grouping. The algorithm groups photos by matching reverse geocoding fields (locality, district, region, country) at different grouping levels. However, the current database schema stores `locality` and `district` combined (`locality: addr.Locality ?? addr.District`) and does not store them separately. This means:

1. DISTRICT grouping level produces identical results to CITY grouping (both use the same combined field)
2. The `autoGroupPhotosIntoWaves` function constructs a pseudo-geo object from DB fields but sets `district: null` because the column doesn't exist
3. The auto-grouping loop unnecessarily calls reverse geocode API even though locality data exists in the database

The Photos table currently has: `locality` (combined), `localityLevel`, `region`, `country`, `countryCode`. A new `district` column is needed.

## Goals / Non-Goals

**Goals:**
- Add `district` column to Photos table to store district separately from locality
- Update photo creation to store locality and district as separate fields
- Backfill existing photos with district data
- Expose `district` field via GraphQL schema
- Simplify autoGroupPhotosIntoWaves to read all locality fields from database (eliminate reverse geocode calls from grouping loop)
- Fix DISTRICT grouping level to work correctly with separate district field

**Non-Goals:**
- Changing the reverse geocode API integration (AWS Geo Places)
- Modifying existing Waves table structure
- Implementing new grouping algorithms
- Changing the auto-grouping algorithm logic (field-matching approach stays)

## Decisions

### Decision 1: Store district as separate nullable STRING column

**Choice**: Add `district STRING NULL` column to Photos table.

**Rationale**: 
- AWS Geo Places returns `Address.District` as a separate field from `Address.Locality`
- Storing them separately allows DISTRICT grouping level to work correctly
- NULL allows photos without district data (edge cases, failed geocodes)
- Consistent with existing locality fields pattern

**Alternatives considered**:
- Combine district into locality field: Rejected — loses distinction needed for DISTRICT grouping
- Derive district from locality at query time: Rejected — not reliable, locality/district are not hierarchical in all countries

### Decision 2: Two-step migration (add column, then backfill)

**Choice**: Create two separate migrations:
1. `add-photo-district.js` — adds `district` column with `ALTER TABLE ... ADD COLUMN`
2. `backfill-photo-district.js` — backfills existing photos in batches

**Rationale**:
- Adding column first is safe and instant (NULL values for existing rows)
- Backfill can be run separately, in batches, with retry logic
- If backfill fails, column already exists — no rollback needed
- Follows existing pattern from `20260514000000-add-photo-locality.js` migration

**Alternatives considered**:
- Single migration with add + backfill: Rejected — longer running, harder to retry
- Backfill via Lambda function: Rejected — batch migration is simpler for one-time data population

### Decision 3: Update photo creation to store district separately

**Choice**: In `lambda-fns/controllers/photos/create.ts`, change the reverse geocode result mapping:
```typescript
locality: addr.Locality ?? null,
district: addr.District ?? null,
```

**Rationale**:
- Stores both fields independently from the start
- `localityLevel` is derived from whether `Locality` is present (unchanged)
- Existing photos will be backfilled separately
- Follows AWS Geo Places API structure directly

**Alternatives considered**:
- Keep `locality: addr.Locality ?? addr.District`: Rejected — loses distinction needed for DISTRICT grouping
- Store both as combined string: Rejected — defeats purpose of separate fields

### Decision 4: Eliminate reverse geocode from autoGroupPhotosIntoWaves

**Choice**: Remove all reverse geocode API calls from `autoGroupPhotosIntoWaves`. The function will construct the geo object entirely from database fields:
```typescript
const geo = {
  locality: photo.locality,
  district: photo.district,  // NEW — now available from DB
  region: photo.region,
  country: photo.country,
  countryCode: photo.countryCode
};
```

**Rationale**:
- All locality data is already stored in the database on photo creation
- Eliminates N reverse geocode API calls per auto-group invocation (one call per photo in the batch)
- Faster, cheaper, more reliable (no external API dependency)
- Follows user's explicit requirement: "Once the reverse geo location was stored in the database, we should never need to call it again"

**Alternatives considered**:
- Keep reverse geocode as fallback for photos with null locality: Rejected — photo creation already handles geocode failure by storing empty strings; no need to re-geocode
- Hybrid approach (DB first, API fallback): Rejected — adds complexity without benefit

### Decision 5: Expose district via GraphQL schema

**Choice**: Add `district: String` field to Photo type in `graphql/schema.graphql`.

**Rationale**:
- Clients may need to read district data for UI display
- Consistent with existing locality fields (locality, region, country, countryCode)
- Non-breaking addition (nullable field)

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Backfill takes long time for large photo sets | Process in batches of 1000; use pagination; allow partial completion |
| Backfill hits AWS Geo Places API rate limits | Add delays between batches; implement exponential backoff |
| Existing photos have no district data after migration | Backfill populates from reverse geocode; photos without district get null (graceful degradation) |
| GraphQL schema change breaks existing clients | District field is nullable and additive — existing queries won't break; clients opt-in to query it |
| Photo creation latency increases slightly | Negligible — one extra field assignment from already-fetched geocode result |

## Migration Plan

### Step 1: Deploy schema changes (non-destructive)
1. Deploy migration to add `district` column to Photos table
2. Deploy GraphQL schema change (add `district` field to Photo type)
3. Deploy code changes to photo creation (store district separately)
4. No data loss — column is NULL for existing rows

### Step 2: Backfill existing photos
1. Run backfill migration to populate `district` for all existing photos
2. Process in batches of 1000 photos
3. Call reverse geocode for each photo's lat/lon
4. Store `Address.District ?? null` in `district` column
5. Verify completion via hasMore flag

### Step 3: Simplify auto-grouping
1. Deploy updated `autoGroupPhotosIntoWaves` that reads from DB
2. Remove reverse geocode calls from grouping loop
3. Monitor Lambda invocation logs to confirm no geocode API calls
4. Verify DISTRICT grouping produces different results than CITY grouping

### Step 4: Rollback plan
- If backfill fails: column already exists, just re-run backfill
- If photo creation breaks: revert code deployment, column exists but unused
- If auto-grouping breaks: revert code deployment, old behavior restored (district column unused)

## Open Questions

1. **Backfill strategy for photos without lat/lon**: Should photos with null coordinates be skipped during backfill? (Assumption: yes, skip photos with null lat/lon)
2. **Backfill monitoring**: Should a separate Lambda function handle backfill, or use a script? (Assumption: batch migration script is sufficient for one-time backfill)
3. **GraphQL query for district-specific grouping**: Should clients be able to query photos by district? (Out of scope — can be added later if needed)
