# Spec: Photo Localities

## Purpose
Define how photo localities are populated via AWS Geo Places reverse geocoding, enabling semantic wave naming and location-based grouping.

## Requirements

### Requirement: Photo Locality Fields
The Photo type MUST have the following nullable string fields:
- `locality: String` — city, town, or district name
- `localityLevel: String` — "locality" or "district"
- `region: String` — state or province name
- `country: String` — country name
- `countryCode: String` — ISO 3166-1 alpha-2 country code

### Requirement: Reverse Geocode on Photo Creation
When a photo is created via `createPhoto` mutation:
- AWS Geo Places `ReverseGeocodeCommand` MUST be called with the photo's lat/lon
- On success: store structured address fields from `Address` object
- On failure: store empty strings (`""`) for all locality fields
- Geocode failure MUST NOT prevent photo creation

#### Scenario: Photo creation with successful geocode
- **GIVEN** a photo at valid coordinates
- **WHEN** the photo is created
- **THEN** all 5 locality fields are populated from the geocode result

#### Scenario: Photo creation with failed geocode
- **GIVEN** a photo at valid coordinates
- **WHEN** the AWS Geo Places API fails
- **THEN** the photo is created with empty string locality fields

### Requirement: Reverse Geocode Address Mapping
The AWS Geo Places `Address` object MUST be mapped as follows:
- `locality` ← `Address.Locality ?? Address.District`
- `localityLevel` ← `"locality"` if Locality present, `"district"` if only District
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
The Photos table MUST gain 5 nullable STRING columns:
- `locality` STRING NULL
- `localityLevel` STRING NULL
- `region` STRING NULL
- `country` STRING NULL
- `countryCode` STRING NULL
