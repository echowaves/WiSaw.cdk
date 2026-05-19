## Why

The current auto-grouping implementation uses a batch-oriented approach that groups photos by matching geographic keys in a single operation. The new model shifts to an active-wave paradigm where photos are added to waves incrementally as they're uploaded, with groupingLevel stored on each wave. This enables dynamic wave creation based on photo location drift and grouping level changes, providing a more natural grouping experience that follows how users actually take and organize photos.

## What Changes

- **Remove `localityLevel` from Photo type** — replaced by `groupingLevel` on Wave, which is the single source of truth for grouping granularity
- **Remove `localityLevel` parameter from `createPhoto` mutation** — photos no longer carry grouping granularity at upload time
- **Add `groupingLevel` to Wave** — stored when a wave is created, used for all subsequent photo-fit comparisons
- **Add anchor fields to Wave** (`anchorLocality`, `anchorDistrict`, `anchorRegion`, `anchorCountry`) — the geocode fields of the anchor photo that defines the wave's geographic scope
- **Add `isActive` to Wave** — each user has exactly one active wave at a time; when a new wave is created, the old one becomes inactive
- **Rewrite `autoGroupPhotosIntoWaves`** — processes ALL ungrouped photos chronologically in one call, creating new waves as needed when:
  - The passed `groupingLevel` differs from the active wave's `groupingLevel`
  - A photo doesn't fit the active wave based on field matching at the wave's `groupingLevel`
- **Add `isNewWave` to `AutoGroupResult`** — indicates whether the last processed photo triggered a new wave creation
- **Photo upload no longer assigns photos to waves** — photos remain "ungrouped" until `autoGroupPhotosIntoWaves` is invoked

## Capabilities

### New Capabilities
- `auto-group-waves`: Active wave model with grouping level management, anchor-based photo fitting, and chronological batch processing

### Modified Capabilities
- `auto-group-photos`: Existing auto-group spec needs requirements updated to reflect the new active-wave model, field-based matching, and grouping level storage

## Impact

- **GraphQL schema**: Photo type, Wave type, createPhoto mutation, autoGroupPhotosIntoWaves mutation, AutoGroupResult type all change
- **Database**: Photos table loses `locality_level` column; Waves table gains `anchorLocality`, `anchorDistrict`, `anchorRegion`, `anchorCountry`, `isActive` columns
- **Lambda functions**: `autoGroupPhotosIntoWaves.ts` (rewrite), `create.ts` (photo creation), `getWave.ts` (new fields)
- **Models**: Photo model (remove localityLevel), Wave model (add anchor fields + isActive)
- **Migrations**: Schema changes for both Photos and Waves tables
