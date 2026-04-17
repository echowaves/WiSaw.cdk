## ADDED Requirements

### Requirement: Auto-group processes only ungrouped active photos
The system SHALL process active photos that are not linked in `WavePhotos`, ordered by `createdAt` ascending.

#### Scenario: Previously grouped photos are excluded
- **WHEN** `autoGroupPhotosIntoWaves(uuid)` runs
- **THEN** photos already present in `WavePhotos` are ignored

#### Scenario: Inactive photos are excluded
- **WHEN** user has inactive photos (`active=false`) not linked to any wave
- **THEN** those photos are not considered by auto-group

### Requirement: Auto-group uses anchor-based geo grouping
For each invocation, the first geolocated photo in the candidate set is used as an anchor. Photos within 100km haversine distance from the anchor are grouped with it. Photos without location may still be included in the grouped set processed by that invocation.

#### Scenario: One invocation processes one group
- **WHEN** multiple disjoint candidate groups exist
- **THEN** only one group is processed in that call

#### Scenario: No geolocated photo in candidates
- **WHEN** candidate set has only locationless photos
- **THEN** grouping still processes one invocation group, without geo-distance partitioning

### Requirement: Auto-group creates at most one wave per invocation
The mutation creates at most one wave per call. Caller must have a `Secrets` record. Created wave has `open=false`, `createdBy=uuid`, creator is inserted into `WaveUsers` with `role='owner'`, `splashDate` is the earliest grouped photo date, and `freezeDate` is the latest grouped photo date.

#### Scenario: Missing secret blocks grouping
- **WHEN** caller has no `Secrets` record
- **THEN** mutation fails

#### Scenario: Created wave is immediately frozen by date window
- **WHEN** grouped photos are historical
- **THEN** resulting wave uses historical `splashDate`/`freezeDate`, making it frozen under date rules

### Requirement: Grouped photos are linked and counts returned
All selected photos are linked to the created wave through `WavePhotos`. The result returns `photosGrouped`, `photosRemaining`, `hasMore`, `waveUuid`, and `name`.

#### Scenario: Remaining ungrouped photos
- **WHEN** ungrouped photos remain after a call
- **THEN** `hasMore=true` and `photosRemaining>0`

#### Scenario: Grouping complete
- **WHEN** no ungrouped photos remain
- **THEN** `hasMore=false` and `photosRemaining=0`

#### Scenario: Nothing grouped this invocation
- **WHEN** no eligible ungrouped photos are found at invocation start
- **THEN** result reports `photosGrouped=0`, `hasMore=false`, and `photosRemaining=0`

### Requirement: Radius is derived from group spread
If geolocated photos exist, radius is computed from max anchor distance as `max(maxDistance*1.2, maxDistance+10, 5)`. If no geolocated photos exist, location is `NULL` and no geo-fence radius calculation is applied from coordinates.

#### Scenario: Radius floor applies to tight clusters
- **WHEN** all grouped geolocated photos are very close to anchor
- **THEN** radius is at least 5km

#### Scenario: Additive buffer dominates percentage buffer
- **WHEN** `maxDistance+10` is greater than `maxDistance*1.2`
- **THEN** additive buffer branch defines radius

### Requirement: Name uses reverse geocoding plus date range
Wave name follows `<Location>, <DateRange>`. Location is resolved via AWS Geo Places reverse geocoding when possible, with coordinate fallback if no location label is available.

#### Scenario: Reverse geocoding success
- **WHEN** AWS Geo Places resolves a locality for anchor coordinates
- **THEN** wave name uses that locality label

#### Scenario: Reverse geocoding fallback
- **WHEN** no locality label is returned or request fails
- **THEN** wave name uses coordinate-based fallback text