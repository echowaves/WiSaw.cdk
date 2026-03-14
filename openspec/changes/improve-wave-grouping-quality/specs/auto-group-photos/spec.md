## MODIFIED Requirements

### Requirement: Auto-group names waves using reverse geocoding and date range
The system SHALL name each auto-created wave using the pattern `"<Location>, <DateRange>"` where Location is the city or area name from reverse geocoding the cluster centroid **in English**, and DateRange reflects the timespan of photos in the cluster. The system SHALL geocode only the oldest temporal cluster per invocation (exactly one HTTP call). When reverse geocoding fails, the system SHALL NOT automatically create an `"Uncategorized"` wave. Instead, the system SHALL check for existing waves belonging to the user and assign the failed cluster's photos to the nearest wave in time. Only when geocoding fails AND no existing waves exist for the user SHALL the system create an `"Uncategorized, <DateRange>"` wave as a catch-all.

#### Scenario: Successful geocoding
- **WHEN** a cluster's centroid reverse geocodes successfully
- **THEN** the wave name SHALL use the English place name (e.g., `"Paris, Jun 2024"`)

#### Scenario: Geocoding failure with existing waves — absorb photos
- **WHEN** reverse geocoding fails for the oldest cluster's centroid AND the user has existing waves
- **THEN** the system SHALL NOT create an "Uncategorized" wave; instead each photo in the failed cluster SHALL be assigned to the existing wave whose date-range midpoint is nearest to the photo's `createdAt`

#### Scenario: Geocoding failure with no existing waves — create catch-all
- **WHEN** reverse geocoding fails for the oldest cluster's centroid AND the user has NO existing waves
- **THEN** the system SHALL create a wave named `"Uncategorized, <DateRange>"` with NULL location geometry

#### Scenario: One geocoding call per invocation
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked
- **THEN** at most one reverse geocoding HTTP call SHALL be made

#### Scenario: Absorbed photos count in result
- **WHEN** geocoding fails and photos are absorbed into an existing wave
- **THEN** the result SHALL report the count of absorbed photos in `photosGrouped` and correctly reflect `photosRemaining` and `hasMore`

### Requirement: Auto-group assigns locationless photos to nearest wave in time
When no more spatial clusters remain to process, the system SHALL find all ungrouped active photos without a location for the user and assign each one to the existing wave whose time range is nearest to the photo's `createdAt`. Time distance SHALL be calculated as the absolute difference between the photo's `createdAt` and the wave's date-range midpoint. All locationless photos SHALL be assigned in a single invocation.

#### Scenario: Locationless photo assigned to nearest wave
- **WHEN** spatial clustering is complete, a user has 3 waves (Jan 2024, Jun 2024, Dec 2024), and a locationless photo was created on May 15, 2024
- **THEN** the photo SHALL be assigned to the Jun 2024 wave (nearest in time)

#### Scenario: Locationless photos processed only after spatial clusters exhausted
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked and spatial clusters still exist
- **THEN** locationless photos SHALL NOT be assigned yet; only the oldest spatial cluster SHALL be processed
