## ADDED Requirements

### Requirement: Cluster user's photos by geographic location
The system SHALL cluster a given user's active photos (not in any Wave) by proximity and return one representative location per cluster. The `location` column SHALL be cast to `geometry` (via `::geometry`) before being passed to `ST_ClusterDBSCAN`, `ST_Y`, and `ST_X` to ensure compatibility regardless of the column's stored type.

#### Scenario: Clusters returned for user's photos
- **WHEN** `listPhotoLocations(uuid, radius)` is called
- **THEN** the system runs DBSCAN clustering (`ST_ClusterDBSCAN`) on the geographic coordinates of all active photos owned by `uuid` that are not associated with any Wave, grouping them using the specified radius (default 50 km), and returns one entry per cluster

#### Scenario: Cluster result fields
- **WHEN** clusters are computed
- **THEN** each `PhotoLocation` in the result contains the centroid latitude and longitude (`AVG` of all points in the cluster), the count of photos in the cluster (`photoCount`), the `oldestPhotoDate`, and the `newestPhotoDate`

#### Scenario: Default radius applied when not provided
- **WHEN** `listPhotoLocations` is called without a `radius` argument (or with `radius: 0`)
- **THEN** a default radius of 50 km is used for clustering

#### Scenario: Results ordered by recency
- **WHEN** `listPhotoLocations` returns clusters
- **THEN** clusters are ordered by `newestPhotoDate` descending so the most recently active locations appear first

#### Scenario: Location column cast to geometry for PostGIS functions
- **WHEN** the clustering query calls `ST_Y`, `ST_X`, or `ST_ClusterDBSCAN` on `Photos.location`
- **THEN** the column SHALL be cast as `location::geometry` in the SQL
