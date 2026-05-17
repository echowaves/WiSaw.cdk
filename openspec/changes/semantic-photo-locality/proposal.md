# Change: semantic-photo-locality

## Why

Fixed-radius photo grouping (100km default) is arbitrary and doesn't match how humans organize photos by place. A 100km radius groups photos from different cities together in rural areas but splits a single city's photos across multiple waves in dense urban areas.

AWS Geo Places reverse geocoding returns structured address data (Locality, District, Region, Country) that maps naturally to how people think about photo grouping. Semantic grouping by locality produces waves that are meaningful to users: "Berlin, March 2026" instead of "51.5°N, 0.1°W, March 2026".

## What Changes

- Replace `radius: Int` parameter on wave mutations with `granularity: GranularityEnum`
- Add structured locality fields to Photo type (locality, localityLevel, region, country, countryCode)
- Reverse geocode photos on creation using AWS Geo Places
- Group photos by semantic locality instead of fixed distance radius
- Granularity hierarchy: DISTRICT → CITY → REGION → COUNTRY with distance fallbacks

## Capabilities

### New: Photo Localities (photo-locality)
- Photo type gets 5 nullable locality fields from reverse geocoding
- Reverse geocode runs on photo creation, stores structured address data
- Migration backfills locality for existing photos

### Modified: Auto-group Photos (auto-group-photos)
- `radius: Int` replaced with `granularity: GranularityEnum` on createWave, updateWave, autoGroupPhotosIntoWaves
- Grouping threshold derived from granularity level (DISTRICT=10km, CITY=50km, REGION=250km, COUNTRY=1000km)
- Wave name uses locality at selected granularity level
- Default granularity: CITY
