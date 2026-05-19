## Why

The field-matching auto-grouping algorithm requires a separate `district` field to work correctly at the DISTRICT grouping level, but the current database stores `locality` and `district` combined (or loses `district` entirely). This means DISTRICT grouping produces identical results to CITY grouping, and the auto-grouping logic incorrectly calls reverse geocode in the grouping loop instead of reading from the database.

## What Changes

- **Add `district` column** to Photos table via new migration
- **Update photo creation** (`lambda-fns/controllers/photos/create.ts`) to store `locality` and `district` as separate fields from reverse geocoding results
- **Backfill existing photos** with a two-step migration: add column, then populate `district` from existing locality data or via batch reverse geocode
- **Update GraphQL schema** to expose `district` field on Photo type
- **Update Photo TypeScript interface** to include `district` field
- **Simplify autoGroupPhotosIntoWaves** to read all locality fields (including `district`) directly from the database — eliminating all reverse geocode API calls from the grouping loop
- **Fix `computeWaveNameFromKey`** to use `geo.district` for DISTRICT grouping and `geo.locality` for CITY grouping (already partially implemented but broken due to missing DB column)

## Capabilities

### New Capabilities
- `photo-district-field`: Separate district field storage and retrieval for photo locality data

### Modified Capabilities
- `auto-group-photos`: Auto-grouping no longer calls reverse geocode API — reads all fields from database; DISTRICT grouping level now works correctly with separate district field
- `photo-locality`: Photo creation now stores locality and district as separate fields instead of combined

## Impact

- **Database**: New `district` column on Photos table, backfill migration for existing rows
- **GraphQL Schema**: Photo type gains `district: String` field
- **Photo Creation**: Reverse geocode result mapping changes to store `district` separately
- **Auto-Grouping**: Removes reverse geocode dependency from `autoGroupPhotosIntoWaves` — all locality data read from DB
- **Migration**: Two-step migration (add column + backfill)
- **API Calls**: Eliminates N reverse geocode calls per auto-group invocation (reads from DB instead)
