## MODIFIED Requirements

### Requirement: Auto-group names waves using reverse geocoding and date range
The system SHALL name each auto-created wave using the pattern `"<Location>, <DateRange>"` where Location is the city or area name from reverse geocoding the cluster centroid **in English**, and DateRange reflects the timespan of photos in the cluster. The Nominatim reverse geocoding request SHALL include the parameter `accept-language=en`. The system SHALL geocode only the oldest temporal cluster per invocation (exactly one HTTP call). When reverse geocoding fails, the system SHALL name the wave `"Uncategorized, <DateRange>"` and create it immediately with NULL location geometry.

#### Scenario: Successful geocoding
- **WHEN** a cluster's centroid reverse geocodes successfully
- **THEN** the wave name SHALL use the English place name (e.g., `"Paris, Jun 2024"`)

#### Scenario: Geocoding failure — immediate fallback
- **WHEN** reverse geocoding fails for the oldest cluster's centroid
- **THEN** the wave SHALL be created immediately with name `"Uncategorized, <DateRange>"` and NULL location geometry, without attempting geocoding on other clusters

#### Scenario: One geocoding call per invocation
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked
- **THEN** at most one reverse geocoding HTTP call SHALL be made, regardless of how many temporal clusters exist

### Requirement: Auto-group assigns locationless photos to nearest wave in time
When no more spatial clusters remain to process, the system SHALL find all ungrouped active photos without a location for the user and assign each one to the existing wave whose time range is nearest to the photo's `createdAt`. Time distance SHALL be calculated as the absolute difference between the photo's `createdAt` and the wave's date-range midpoint. All locationless photos SHALL be assigned in a single invocation. Photos from geocoding-failed clusters SHALL NOT be included in this pass — they SHALL have already been assigned to their own `"Uncategorized"` wave during spatial cluster processing.

#### Scenario: Locationless photo assigned to nearest wave
- **WHEN** spatial clustering is complete, a user has 3 waves (Jan 2024, Jun 2024, Dec 2024), and a locationless photo was created on May 15, 2024
- **THEN** the photo SHALL be assigned to the Jun 2024 wave (nearest in time)

#### Scenario: Locationless photos processed only after spatial clusters exhausted
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked and spatial clusters still exist
- **THEN** locationless photos SHALL NOT be assigned yet; only the oldest spatial cluster SHALL be processed
