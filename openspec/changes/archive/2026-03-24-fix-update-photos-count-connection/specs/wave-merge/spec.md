## MODIFIED Requirements

### Requirement: _updatePhotosCount does not manage connection lifecycle
The `_updatePhotosCount` helper SHALL NOT call `psql.connect()` or `psql.clean()`. It SHALL only execute its UPDATE query and return the result, relying on the caller to manage the connection lifecycle.

#### Scenario: Called within mergeWaves
- **WHEN** `mergeWaves` calls `_updatePhotosCount` mid-operation
- **THEN** the connection SHALL remain alive for subsequent queries after `_updatePhotosCount` returns

#### Scenario: Called within addPhotoToWave
- **WHEN** `addPhotoToWave` calls `_updatePhotosCount` after inserting or removing a WavePhotos row
- **THEN** the connection SHALL remain alive for any subsequent operations

#### Scenario: Called within processDeletedImage
- **WHEN** `processDeletedImage` calls `_updatePhotosCount` within its cleanup block
- **THEN** the function SHALL execute successfully using the caller's existing connection
