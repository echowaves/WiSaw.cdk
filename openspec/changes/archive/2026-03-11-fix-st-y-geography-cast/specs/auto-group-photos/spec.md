## MODIFIED Requirements

### Requirement: Auto-group clusters photos by spatial proximity
The system SHALL cluster a user's ungrouped photos using PostGIS `ST_ClusterDBSCAN` with an epsilon of approximately 50km (`50 * 0.009` degrees) and `minpoints = 1` so that every photo is assigned to a spatial cluster. The `location` column SHALL be cast to `geometry` (via `::geometry`) before being passed to `ST_ClusterDBSCAN`, `ST_Y`, and `ST_X` to ensure compatibility regardless of the column's stored type.

#### Scenario: Photos clustered by proximity
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is invoked for a user with ungrouped photos at various locations
- **THEN** photos within ~50km of each other SHALL be grouped into the same spatial cluster

#### Scenario: Isolated photo forms its own cluster
- **WHEN** a photo's location is more than 50km from all other ungrouped photos
- **THEN** that photo SHALL form its own single-photo spatial cluster

#### Scenario: Location column cast to geometry for PostGIS functions
- **WHEN** the clustering query calls `ST_Y`, `ST_X`, or `ST_ClusterDBSCAN` on `Photos.location`
- **THEN** the column SHALL be cast as `location::geometry` in the SQL
