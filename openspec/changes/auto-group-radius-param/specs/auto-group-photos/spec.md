## MODIFIED Requirements

### Requirement: Auto-group uses anchor-based geo grouping
For each invocation, the first geolocated photo in the candidate set is used as an anchor. Photos within `radius` km haversine distance from the anchor are grouped with it. Photos without location may still be included in the grouped set processed by that invocation. The `radius` parameter is optional and defaults to 100km.

#### Scenario: One invocation processes one group
- **WHEN** multiple disjoint candidate groups exist
- **THEN** only one group is processed in that call

#### Scenario: No geolocated photo in candidates
- **WHEN** candidate set has only locationless photos
- **THEN** grouping still processes one invocation group, without geo-distance partitioning

#### Scenario: Custom radius is used
- **WHEN** `autoGroupPhotosIntoWaves(uuid, radius: 50)` is called
- **THEN** photos within 50km of the anchor are grouped

#### Scenario: Default radius when not provided
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` is called without a radius
- **THEN** photos within 100km of the anchor are grouped
