## Why

The auto-grouping algorithm for waves has two bugs: (1) reverse geocoding returns location names in the local language of each country instead of always using English, making wave names inconsistent and hard to read for English-speaking users; (2) photos without a GPS location are silently excluded from grouping and can never be assigned to any wave, leaving them permanently orphaned.

## What Changes

- Force English place names by adding `accept-language=en` to the Nominatim reverse geocoding request
- When reverse geocoding fails for a spatial cluster (no location name returned), treat those photos the same as locationless photos — do not create a wave with coordinate-based names
- After all geocodable spatial clusters are processed, assign all unresolvable photos (locationless + geocoding-failed) to the nearest existing wave by time proximity (smallest time distance between the photo's `createdAt` and any wave's date range)
- If no waves exist for the user at all, create a catch-all wave named `"Uncategorized, <DateRange>"` for unresolvable photos, applying the same temporal splitting logic
- Include all ungrouped photos (including locationless and geocoding-failed) in the `photosRemaining` count so the client knows there is still work to do

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `auto-group-photos`: Add English-only geocoding, remove coordinate-based name fallback, add assignment of unresolvable photos (locationless + geocoding-failed) to nearest wave in time, update remaining-count logic to include all ungrouped photos

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — modify `reverseGeocode()` URL, add post-clustering sweep for locationless photos, update remaining-count query
- **APIs**: No GraphQL schema changes; `AutoGroupResult` shape is unchanged
- **Dependencies**: None — uses existing Nominatim API parameter
- **Data**: Previously orphaned locationless photos and photos with unresolvable geocoding will now be grouped into waves on next invocation
