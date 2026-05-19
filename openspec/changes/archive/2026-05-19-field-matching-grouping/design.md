## Context

The current auto-grouping system uses distance-based thresholds (haversine distance from anchor photo) to group photos into waves. A `Granularity` enum value maps to a distance threshold (DISTRICT=10km, CITY=50km, REGION=250km, COUNTRY=1000km). Photos within the threshold distance are grouped together, and the wave name uses reverse geocoding to get a locality name.

The Photos table has 5 locality fields (`locality`, `localityLevel`, `region`, `country`, `countryCode`) populated by AWS Geo Places reverse geocoding. The Waves table has a `granularity` column storing the grouping level used.

The problem: distance-based grouping produces inconsistent results. Photos in the same city but >50km apart end up in different waves, while photos in different cities within 50km of each other get grouped together.

## Goals / Non-Goals

**Goals:**
- Replace distance-based grouping with field-matching based on reverse geocoding locality data
- Rename `Granularity` → `GroupingLevel` (enum) and `granularity` → `groupingLevel` (column/parameter)
- Define clear field-matching rules per grouping level
- Remove haversine distance calculations from grouping logic

**Non-Goals:**
- Changing how locality fields are populated on Photos (reverse geocoding stays the same)
- Migrating existing waves' groupingLevel values
- Adding multi-wave grouping (still one wave per invocation)
- Changing the GraphQL API response type (`AutoGroupResult`)

## Decisions

### Decision 1: Field-matching instead of distance

**Choice**: Photos are grouped when their locality fields match the required set for the grouping level. No distance calculations.

**Rationale**: Field-matching produces semantically correct groupings. Two photos in Manhattan will always be grouped together regardless of whether one is at the southern tip and one at Central Park.

**Alternatives considered**:
- Keep distance as secondary filter → adds complexity, still arbitrary
- Hybrid approach (field-matching + max distance) → defeats the purpose

### Decision 2: Rename Granularity → GroupingLevel / granularity → groupingLevel

**Choice**: Enum renamed to `GroupingLevel`, column renamed to `groupingLevel`, parameters renamed to `groupingLevel`.

**Rationale**: `groupingLevel` is consistent everywhere — the enum, column, and parameters all share the same name. This eliminates confusion about which term to use. `GroupingLevel` for the enum is the natural noun form of `groupingLevel`.

**Alternatives considered**:
- Keep `granularity` name → ambiguous, doesn't convey field-matching intent
- Use `LocalityLevel` → conflicts with Photos.localityLevel (different concept)

### Decision 3: Wave `radius` defaults to 50

**Choice**: Since distance-based radius computation (`computeClusterRadius`) is removed, `radius` defaults to 50 for all new waves.

**Rationale**: The radius field is used for the wave's geo-fence. With field-matching grouping, the concept of a cluster radius is less meaningful. A fixed default of 50km maintains backward compatibility with any code that reads the radius field.

**Alternatives considered**:
- Set radius to NULL → breaks code that expects an integer
- Compute radius from photo spread (keep old logic) → inconsistent with new grouping approach

### Decision 4: Migration renames column in place

**Choice**: A single migration renames `granularity` → `groupingLevel`, preserving all existing values.

**Rationale**: Existing waves already have valid values ('CITY', 'DISTRICT', etc.) that are compatible with the new `LocalityLevel` enum. No data transformation needed.

### Decision 5: Photos with null locality fields get their own wave

**Choice**: Photos that have null locality fields cannot match any field-matching key and will be grouped into their own wave.

**Rationale**: A photo with null locality cannot be said to match any geographic grouping. It should be isolated.

## Risks / Trade-offs

### Risk: `Photos.localityLevel` vs `Waves.groupingLevel` naming confusion

Photos.localityLevel stores `'locality'`/`'district'` (API response level). Waves.groupingLevel stores `'DISTRICT'`/`'CITY'`/`'REGION'`/`'COUNTRY'` (grouping level). These are different concepts with related names.

→ **Mitigation**: The consistent naming (`groupingLevel` everywhere) makes it clear that the Waves field is about grouping, not about locality detail. The Photos `localityLevel` field is a separate concern (it stores what level of detail the API returned).

### Risk: Photos at same locality but different countries

A photo in "Manhattan, New York, United States" and a photo in "Manhattan, Guam, United States" would be grouped together with `groupingLevel: CITY` since both have locality="Manhattan" and country="United States".

→ **Mitigation**: This is unlikely in practice and is the expected behavior — the grouping level explicitly controls how specific the matching should be.

### Risk: Existing waves have old column name

After deployment but before migration, any code reading the Waves table directly (not via GraphQL) would fail on the old column name.

→ **Mitigation**: Deploy the migration alongside the code change. The rename is atomic within a single transaction.

### Risk: Field-matching may create very large waves

With `groupingLevel: COUNTRY`, all photos in one country get grouped into a single wave (up to 1000 photo limit per invocation).

→ **Mitigation**: This is the user's explicit choice. The 1000 photo per invocation limit still applies.

## Migration Plan

1. **Create migration**: `YYYYMMDDHHMMSS_rename-wave-grouping-level.js`
   - Rename `Waves.granularity` → `Waves.groupingLevel`
   - Preserve existing values
   - Down: rename back

2. **Deploy order**:
   a. Deploy migration + code change together (atomic deploy)
   b. No backward compatibility needed — all resolvers updated simultaneously

3. **Rollback**: Run migration `down` to rename column back to `granularity`

## Impact Map

```
┌─────────────────────────────────────────────────────────────────┐
│                     CHANGE IMPACT MAP                            │
├──────────────────────┬──────────────────────────────────────────┤
│ File                  │ Change                                    │
├──────────────────────┼──────────────────────────────────────────┤
│ graphql/schema.graphql│ Granularity → GroupingLevel (enum)       │
│                       │ granularity → groupingLevel (all params) │
├──────────────────────┼──────────────────────────────────────────┤
│ lambda-fns/index.ts   │ getArgs: args.granularity →               │
│                       │   args.groupingLevel                      │
├──────────────────────┼──────────────────────────────────────────┤
│ lambda-fns/controllers/│ Rename all params:                      │
│ waves/autoGroup...     │   granularity → groupingLevel            │
│                        │ Remove: haversineDistance,               │
│                        │   computeClusterRadius,                 │
│                        │   GRANULARITY_FALLBACKS                 │
│                        │ Add: computeGroupingKey() function       │
├──────────────────────┼──────────────────────────────────────────┤
│ lambda-fns/controllers/│ Rename param: granularity →             │
│ waves/create.ts        │   groupingLevel                          │
├──────────────────────┼──────────────────────────────────────────┤
│ lambda-fns/controllers/│ Rename param: granularity →             │
│ waves/update.ts        │   groupingLevel                          │
├──────────────────────┼──────────────────────────────────────────┤
│ lambda-fns/models/wave.ts│ granularity → groupingLevel           │
├──────────────────────┼──────────────────────────────────────────┤
│ migrations/XXXXX-*.js │ RENAME: granularity → groupingLevel     │
└──────────────────────┴──────────────────────────────────────────┘
```

## New Grouping Algorithm

```
┌──────────────────────────────────────────────────────────────────┐
│                    computeGroupingKey(photo, level)                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  switch level:                                                    │
│    DISTRICT → return [locality, localityLevel,                   │
│                        region, country, countryCode]              │
│    CITY     → return [locality, region, country]                  │
│    REGION   → return [region, country]                            │
│    COUNTRY  → return [country]                                    │
│                                                                  │
│  If any field in the key is null → return ["__null_locality__"]  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    autoGroupPhotosIntoWaves(uuid, groupingLevel)  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Fetch up to 1000 ungrouped active photos                     │
│  2. Find anchor (first photo with lat/lon)                       │
│  3. Geocode anchor → get locality fields                         │
│  4. Compute anchor's grouping key                                │
│  5. For each photo:                                              │
│     a. Compute photo's grouping key (from stored fields)         │
│     b. If key matches anchor's key → collect into wave           │
│  6. Create wave with collected photos                            │
│  7. Return result                                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
