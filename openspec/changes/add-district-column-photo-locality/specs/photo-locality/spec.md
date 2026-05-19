# Spec: Photo Localities (Delta)

## Purpose

Delta spec for modified requirements in photo locality storage — now stores district separately.

## MODIFIED Requirements

### Requirement: Photo Locality Fields
The Photo type MUST have the following nullable string fields:
- `locality: String` — city, town, or district name
- `localityLevel: String` — "locality" or "district"
- `district: String` — **NEW** district/area name (separate from locality)
- `region: String` — state or province name
- `country: String` — country name
- `countryCode: String` — ISO 3166-1 alpha-2 country code

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
- `locality` ← `Address.Locality ?? null` (changed from `Address.Locality ?? Address.District`)
- `localityLevel` ← `"locality"` if Locality present, `"district"` if only District
- `district` ← **NEW** `Address.District ?? null`
- `region` ← `Address.Region.Name`
- `country` ← `Address.Country.Name`
- `countryCode` ← `Address.Country.Code2`

#### Scenario: Photo with both Locality and District
- **GIVEN** reverse geocode result with both Locality="New York" and District="Brooklyn"
- **WHEN** the photo is created
- **THEN** `locality`="New York" and `district`="Brooklyn" (stored separately)

#### Scenario: Photo with only Locality
- **GIVEN** reverse geocode result with Locality="New York" but no District
- **WHEN** the photo is created
- **THEN** `locality`="New York" and `district`=null

### Requirement: Database Schema
The Photos table MUST gain 6 nullable STRING columns (5 existing + 1 new):
- `locality` STRING NULL (existing — meaning changed, no longer combined)
- `localityLevel` STRING NULL (existing)
- `district` STRING NULL (**NEW**)
- `region` STRING NULL (existing)
- `country` STRING NULL (existing)
- `countryCode` STRING NULL (existing)

#### Scenario: Migration adds district column
- **WHEN** the migration runs
- **THEN** `district` column is added to Photos table as STRING NULL
