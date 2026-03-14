## MODIFIED Requirements

### Requirement: Auto-group creates a wave for each cluster
When photos are absorbed into an existing wave (geocoding failure or locationless photo assignment), the `AutoGroupResult` SHALL return the `waveUuid` and `name` of the existing wave that received the most photos. The result SHALL NOT return `waveUuid: null` when `photosGrouped > 0`.

#### Scenario: Absorbed photos return primary wave identity
- **WHEN** geocoding fails and photos are absorbed into existing waves
- **THEN** the result SHALL include `waveUuid` set to the UUID of the wave that received the most photos, and `name` set to that wave's name

#### Scenario: Locationless photos return primary wave identity
- **WHEN** locationless photos are assigned to existing waves on the final pass
- **THEN** the result SHALL include `waveUuid` and `name` of the wave that received the most photos

#### Scenario: No photos grouped returns null
- **WHEN** `autoGroupPhotosIntoWaves` is invoked and no photos are grouped
- **THEN** `waveUuid` and `name` SHALL be null
