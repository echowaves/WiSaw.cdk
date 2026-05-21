# Spec: Is Location In Wave

## Purpose

Provide a GraphQL query and shared geo-distance utilities for checking whether coordinates or photos fall within a wave's geo-boundary using PostGIS `ST_DWithin`.

## Requirements

### Requirement: isLocationInWave query

The system SHALL provide an `isLocationInWave(lat: Float!, lon: Float!, waveUuid: String!, uuid: String!): Boolean!` GraphQL query that returns `true` if the given coordinates fall within the wave's geo-boundary, and `false` otherwise. The query SHALL verify the caller is a member of the wave before performing the geo-check.

#### Scenario: Coordinates within wave radius
- **WHEN** `isLocationInWave(lat, lon, waveUuid, uuid)` is called by a wave member with coordinates within `radius` km of the wave's location
- **THEN** the query SHALL return `true`

#### Scenario: Coordinates outside wave radius
- **WHEN** `isLocationInWave(lat, lon, waveUuid, uuid)` is called by a wave member with coordinates more than `radius` km from the wave's location
- **THEN** the query SHALL return `false`

#### Scenario: Non-member cannot check location
- **WHEN** `isLocationInWave(lat, lon, waveUuid, uuid)` is called by a user who is not a member of the wave
- **THEN** the system SHALL throw an error indicating insufficient permissions

#### Scenario: Wave does not exist
- **WHEN** `isLocationInWave` is called with a `waveUuid` that does not exist
- **THEN** the system SHALL throw an error

#### Scenario: Invalid UUID format
- **WHEN** `isLocationInWave` is called with an invalid `uuid` or `waveUuid` format
- **THEN** the system SHALL throw an error indicating invalid UUID format

### Requirement: Shared geo-distance utility

The system SHALL provide a shared `_isLocationInRadius(lat, lon, waveUuid, radiusKm?)` utility that performs a single PostGIS `ST_DWithin` query. When `radiusKm` is omitted, the wave's stored `radius` SHALL be used. When `radiusKm` is provided, it SHALL override the wave's radius. The utility SHALL return a boolean.

#### Scenario: Using wave's stored radius
- **WHEN** `_isLocationInRadius(lat, lon, waveUuid)` is called without `radiusKm`
- **THEN** the query SHALL use the wave's `radius` column value (converted to meters by multiplying by 1000) in `ST_DWithin`

#### Scenario: Using explicit radius override
- **WHEN** `_isLocationInRadius(lat, lon, waveUuid, 300)` is called with `radiusKm = 300`
- **THEN** the query SHALL use `300 * 1000 = 300000` meters in `ST_DWithin`, ignoring the wave's stored radius

### Requirement: Batch geo-distance utility

The system SHALL provide a `_filterPhotosInRadius(photoIds, waveUuid, radiusKm?)` utility that checks multiple photos against a wave in a single SQL query using `WHERE "id" = ANY($1) AND ST_DWithin(...)`. It SHALL return the subset of photo IDs whose locations fall within range. The `radiusKm` parameter behaves identically to `_isLocationInRadius`.

#### Scenario: Batch check returns matching IDs
- **WHEN** `_filterPhotosInRadius(['p1','p2','p3'], waveUuid, 50)` is called and photos p1 and p3 are within 50 km of the wave
- **THEN** the utility SHALL return `Set(['p1', 'p3'])`

#### Scenario: No photos match
- **WHEN** `_filterPhotosInRadius(['p1','p2'], waveUuid)` is called and no photos are within the wave's radius
- **THEN** the utility SHALL return an empty Set

#### Scenario: Photos without location data excluded
- **WHEN** `_filterPhotosInRadius` includes a photo ID whose location is NULL
- **THEN** that photo ID SHALL NOT appear in the returned set
