# Design: semantic-photo-locality

## Granularity Hierarchy

```
DISTRICT (0) → Address.District     (neighborhood, borough)     - 10km fallback
CITY      (1) → Address.Locality      (city, town)               - 50km fallback (default)
REGION    (2) → Address.Region.Name   (state, province)          - 250km fallback
COUNTRY   (3) → Address.Country.Name (country)                  - 1000km fallback
```

## Distance Fallbacks

Each granularity level maps to a maximum haversine distance for grouping photos:

| Granularity | Fallback Distance | Use Case |
|-------------|-------------------|----------|
| DISTRICT    | 10 km            | Neighborhoods, boroughs |
| CITY        | 50 km            | Cities, metropolitan areas |
| REGION      | 250 km           | States, provinces |
| COUNTRY     | 1000 km          | Countries |

## Failed Geocode Strategy

### New Photos (create.ts)
- Reverse geocode runs on photo creation
- On AWS Geo Places failure → store **empty strings** (`""`) for all locality fields
- This distinguishes "geocode failed" from "geocode returned null"
- Auto-group will still work (locationless photos included in every wave)

### Migration (populate-photo-locality)
- Batch reverse geocode existing photos (1000 per invocation)
- On AWS Geo Places failure → store **null** for all locality fields
- Uses hasMore flag for pagination

## Wave Locality Determination

When auto-grouping:
1. Geocode the **anchor photo** (first photo with location)
2. Extract locality at the selected granularity level using `getLocalityKey()`
3. Wave name = `{localityName}, {dateRange}` (e.g., "Berlin, March 2026")
4. If geocode fails → fallback to coordinates format (existing behavior)

## Per-Invocation Locality Cache

To avoid redundant geocode calls during auto-grouping:
- Maintain a `Map<string, ReverseGeocodeResult>` keyed by `"lat,lon"` string
- Reuse geocode results for photos at the same coordinates within the same invocation
- Cache is cleared between invocations (Lambda cold start)

## computeClusterRadius() — Unchanged

The wave's stored `radius` field represents the geo-fence radius for the wave (used for `listPhotoLocations` and spatial queries). This is computed from the actual photo cluster and is **separate** from the grouping granularity. No changes to `computeClusterRadius()`.

## Default Granularity

- Default: `CITY` (50km fallback)
- If `granularity` parameter is omitted from mutations → CITY is used
- Existing waves without granularity → fall back to 50km behavior
