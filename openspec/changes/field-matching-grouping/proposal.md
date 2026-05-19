## Why

The current auto-grouping uses distance-based thresholds (e.g., 50km for CITY) to group photos, which produces inconsistent results. Photos in the same city but >50km apart end up in different waves, while photos in different cities within 50km of each other (e.g., across a bay) get grouped together. Grouping should be based on actual geographic locality fields from the reverse geocoding API, not arbitrary distance thresholds.

## What Changes

- **Rename `Granularity` enum to `GroupingLevel`** across GraphQL schema, resolvers, and lambda functions
- **Rename `Waves.granularity` column to `Waves.groupingLevel`** via migration
- **Replace distance-based grouping with field-matching grouping**: photos are grouped into the same wave when their locality fields match based on the requested grouping level:
   - `DISTRICT` → all fields must match (`locality`, `localityLevel`, `region`, `country`, `countryCode`)
   - `CITY` → `locality` + `region` + `country` must match
   - `REGION` → `region` + `country` must match
   - `COUNTRY` → only `country` must match
- **Remove distance threshold logic**: no more `GRANULARITY_FALLBACKS`, `haversineDistance`, `computeClusterRadius`
- **Remove `localityLevel` from the grouping key for DISTRICT** — it's an internal API marker (`'locality'`/`'district'`), not a geographic value used for grouping

## Capabilities

### New Capabilities
- `field-matching-grouping`: Deterministic photo-to-wave grouping based on reverse geocoding locality fields, with configurable grouping level (DISTRICT/CITY/REGION/COUNTRY)

### Modified Capabilities
- `auto-group-photos`: Grouping algorithm changes from distance-based to field-matching; enum/column rename from Granularity/granularity to GroupingLevel/groupingLevel

## Impact

- **GraphQL schema**: `Granularity` → `GroupingLevel` (enum), `granularity` → `groupingLevel` (all parameter names)
- **Database**: `Waves.granularity` → `Waves.groupingLevel` (migration)
- **Lambda functions**: `autoGroupPhotosIntoWaves`, `createWave`, `updateWave` — parameter and logic changes
- **Resolvers**: All references to `granularity` → `groupingLevel`
- **Models**: Wave model — `granularity` → `groupingLevel`
- **Existing waves**: Migration preserves existing values in renamed column
