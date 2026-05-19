# Spec: Photo Localities

## Purpose
Define how photo localities are populated via AWS Geo Places reverse geocoding, enabling semantic wave naming and location-based grouping.

## Requirements

### Requirement: Photo Locality Fields
The Photo type MUST have the following nullable string fields:
- `locality: String` — city, town, or district name
- `district: String` — district/area name (separate from locality)
- `localityLevel: String` — "locality" or "district" (provided by client on creation)
- `region: String` — state or province name
- `country: String` — country name
- `countryCode: String` — ISO 3166-1 alpha-2 country code

### Requirement: Reverse Geocode on Photo Creation
When a photo is created via `createPhoto` mutation:
- AWS Geo Places `ReverseGeocodeCommand` MUST be called with the photo's lat/lon
- On success: store structured address fields from `Address` object
- On failure: store empty strings (`""`) for all locality fields
- Geocode failure MUST NOT prevent photo creation
- `localityLevel` is provided by the client (defaults to "locality" if omitted)

#### Scenario: Photo creation with successful geocode
- **GIVEN** a photo at valid coordinates
- **WHEN** the photo is created
- **THEN** all 6 locality fields (including `district`) are populated from the geocode result

#### Scenario: Photo creation with failed geocode
- **GIVEN** a photo at valid coordinates
- **WHEN** the AWS Geo Places API fails
- **THEN** the photo is created with empty string locality fields

### Requirement: Reverse Geocode Address Mapping
The AWS Geo Places `Address` object MUST be mapped as follows:
- `locality` ← `Address.Locality ?? null`
- `district` ← `Address.District ?? null`
- `localityLevel` ← provided by client (defaults to "locality")
- `region` ← `Address.Region.Name`
- `country` ← `Address.Country.Name`
- `countryCode` ← `Address.Country.Code2`

### Requirement: Migration Backfill
A database migration MUST backfill locality for existing photos:
- Process photos in batches of 1000
- Call reverse geocode for each photo's lat/lon
- On success: store structured address fields
- On failure: store null for all locality fields
- Use `hasMore` flag for pagination across invocations

#### Scenario: Migration processes batches
- **GIVEN** existing photos without locality data
- **WHEN** the migration runs
- **THEN** 1000 photos are processed per invocation
- **AND** hasMore flag enables pagination

#### Scenario: Migration failed geocodes
- **GIVEN** a photo where geocode fails during migration
- **WHEN** the migration completes
- **THEN** the photo has null locality fields

### Requirement: Database Schema
The Photos table MUST gain 6 nullable STRING columns (5 existing + 1 new):
- `locality` STRING NULL (existing — meaning changed, no longer combined)
- `district` STRING NULL (**NEW**)
- `localityLevel` STRING NULL (existing)
- `region` STRING NULL (existing)
- `country` STRING NULL (existing)
- `countryCode` STRING NULL (existing)
