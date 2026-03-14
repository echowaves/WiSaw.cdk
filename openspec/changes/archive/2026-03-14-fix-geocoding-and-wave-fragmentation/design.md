## Context

The `autoGroupPhotosIntoWaves.ts` function uses AWS Location Service `ReverseGeocodeCommand` for geocoding and walks the timeline to group photos within 100km of an anchor. Both have bugs:

1. **Geocoding**: Uses `item.Title` which is a POI name (e.g., "Embassy of the Syrian Arab Republic"), not a geographic area name. The `item.Address` object has structured fields: `Locality` (city), `District`, `SubRegion.Name` (county), `Region.Name` (state/province), `Country.Name`.

2. **Walk logic**: `break` on first out-of-range photo. This means one outlier photo (GPS glitch, brief stop) fragments the entire batch.

## Goals / Non-Goals

**Goals:**
- Fix geocoding to produce city/region-level names (e.g., "Tokyo", not "Embassy of Syria")
- Reduce wave fragmentation by skipping outlier photos instead of breaking the walk

**Non-Goals:**
- Changing the distance threshold (100km is fine)
- Changing the max photos per wave (1000)
- Fixing existing misnamed waves in the database

## Decisions

### 1. Use structured Address fields instead of Title
Extract location name from `item.Address` using the fallback chain: `Locality → District → SubRegion.Name → Region.Name → Country.Name`. Return the first non-null value.

**Rationale**: These fields contain geographic area names. `Locality` = city (e.g., "Tokyo"), `Region.Name` = state/province (e.g., "British Columbia"), `Country.Name` = country fallback. This mirrors the old Nominatim approach of `city → town → village → county → state` but with AWS's structured data.

### 2. Skip out-of-range photos instead of breaking
Change the walk loop: when a photo is beyond 100km of the anchor, **skip it** (leave it ungrouped) instead of stopping the walk. Continue checking subsequent photos. This way all in-range photos in the batch get collected into one wave, and outliers remain ungrouped for future processing.

**Rationale**: A single photo taken at an airport, a GPS glitch, or a brief detour shouldn't split a wave. Outlier photos left ungrouped will naturally form their own wave in a later invocation — either joining other nearby photos or becoming a small standalone wave.

## Risks / Trade-offs

- [Skipping outliers could leave isolated photos ungrouped longer] → They'll be picked up in subsequent invocations and grouped with other nearby photos or form their own wave
- [Address.Locality might be null for remote areas] → Fallback chain goes through District, SubRegion, Region, Country — very unlikely all are null
