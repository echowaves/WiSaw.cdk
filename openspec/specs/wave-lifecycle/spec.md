### Requirement: Wave start and end dates
The system SHALL support optional `startDate` and `endDate` fields on waves. When `startDate` is set and `NOW() < startDate`, the wave SHALL NOT accept new photo contributions. When `endDate` is set and `NOW() > endDate`, the wave SHALL be considered frozen.

#### Scenario: Contributions rejected before startDate
- **WHEN** `addPhotoToWave` is called on a wave where `startDate` is set and `NOW() < startDate`
- **THEN** the system SHALL throw an error indicating the wave is not yet accepting contributions

#### Scenario: Wave auto-freezes past endDate
- **WHEN** any mutation checks the frozen state of a wave with `endDate` in the past
- **THEN** the wave SHALL be considered frozen (equivalent to `frozen = true`)

#### Scenario: No dates set — no restrictions
- **WHEN** `startDate` and `endDate` are both `NULL`
- **THEN** the wave SHALL have no date-based restrictions

### Requirement: Manual freeze and unfreeze
The system SHALL allow the wave owner to manually freeze or unfreeze a wave via the `frozen` field on `updateWave`. Only the owner SHALL be able to change the `frozen` field.

#### Scenario: Owner freezes wave
- **WHEN** `updateWave(waveUuid, uuid, frozen: true)` is called by the owner
- **THEN** `Waves.frozen` SHALL be set to `true`

#### Scenario: Owner unfreezes wave
- **WHEN** `updateWave(waveUuid, uuid, frozen: false)` is called by the owner on a manually frozen wave
- **THEN** `Waves.frozen` SHALL be set to `false`

#### Scenario: Owner unfreezes auto-frozen wave
- **WHEN** `updateWave(waveUuid, uuid, frozen: false, endDate: <future or null>)` is called by the owner on a wave frozen by `endDate`
- **THEN** `Waves.frozen` SHALL be set to `false` and `endDate` SHALL be updated, making the wave no longer frozen

### Requirement: Frozen wave immutability
When a wave is in the frozen state (either `frozen = true` or `endDate` is past), the system SHALL block all modifications except: the owner changing `frozen` and `endDate` fields, the owner removing photos, and the owner deleting the wave.

#### Scenario: addPhotoToWave blocked on frozen wave
- **WHEN** `addPhotoToWave` is called on a frozen wave
- **THEN** the system SHALL throw an error indicating the wave is frozen

#### Scenario: removePhotoFromWave blocked for non-owner on frozen wave
- **WHEN** `removePhotoFromWave` is called by a facilitator or contributor on a frozen wave
- **THEN** the system SHALL throw an error indicating the wave is frozen

#### Scenario: Owner can remove photo from frozen wave
- **WHEN** `removePhotoFromWave` is called by the owner on a frozen wave
- **THEN** the photo SHALL be unlinked from the wave and `photosCount` SHALL be updated

#### Scenario: updateWave blocked on frozen wave (non-freeze fields)
- **WHEN** `updateWave` is called on a frozen wave with changes to `name`, `description`, `location`, `radius`, `open`, or `startDate`
- **THEN** the system SHALL throw an error indicating the wave is frozen

#### Scenario: updateWave allowed for unfreeze on frozen wave
- **WHEN** `updateWave` is called on a frozen wave with only `frozen` and/or `endDate` fields changed
- **THEN** the update SHALL proceed

#### Scenario: deleteWave allowed on frozen wave
- **WHEN** `deleteWave` is called by the owner on a frozen wave
- **THEN** the wave SHALL be deleted (owner privilege overrides freeze for full deletion)

#### Scenario: mergeWaves blocked if either wave is frozen
- **WHEN** `mergeWaves` is called and either the source or target wave is frozen
- **THEN** the system SHALL throw an error indicating frozen waves cannot be merged

#### Scenario: banUserFromWave blocked on frozen wave
- **WHEN** `banUserFromWave` is called on a frozen wave
- **THEN** the system SHALL throw an error indicating the wave is frozen

#### Scenario: removeUserFromWave blocked on frozen wave
- **WHEN** `removeUserFromWave` is called on a frozen wave
- **THEN** the system SHALL throw an error indicating the wave is frozen

### Requirement: Frozen wave check utility
The system SHALL provide `_isWaveFrozen(wave)` that returns `true` if `wave.frozen = true` OR (`wave.endDate IS NOT NULL` AND `NOW() > wave.endDate`). A companion `_assertNotFrozen(wave)` SHALL throw an error if the wave is frozen.

#### Scenario: Manually frozen wave detected
- **WHEN** `_isWaveFrozen` is called on a wave with `frozen = true` and no `endDate`
- **THEN** the function SHALL return `true`

#### Scenario: Auto-frozen wave detected
- **WHEN** `_isWaveFrozen` is called on a wave with `frozen = false` and `endDate` in the past
- **THEN** the function SHALL return `true`

#### Scenario: Active wave detected
- **WHEN** `_isWaveFrozen` is called on a wave with `frozen = false` and no `endDate`
- **THEN** the function SHALL return `false`

### Requirement: Frozen wave protects photos globally
When a photo belongs to a frozen wave, the system SHALL prevent global soft-deletion of that photo via `deletePhoto`. A shared utility `_isPhotoInFrozenWave(photoId)` SHALL check if the photo is in any frozen wave.

#### Scenario: deletePhoto blocked for photo in frozen wave
- **WHEN** `deletePhoto(photoId, uuid)` is called and the photo has a `WavePhotos` record in a frozen wave
- **THEN** the system SHALL throw an error indicating the photo belongs to a frozen wave and cannot be deleted

#### Scenario: deletePhoto allowed for photo in unfrozen wave
- **WHEN** `deletePhoto(photoId, uuid)` is called and the photo is in a non-frozen wave
- **THEN** the photo SHALL be soft-deleted (`active = false`) and `photosCount` SHALL be updated for the wave

#### Scenario: deletePhoto allowed for photo not in any wave
- **WHEN** `deletePhoto(photoId, uuid)` is called and the photo has no `WavePhotos` record
- **THEN** the photo SHALL be soft-deleted normally

### Requirement: Frozen wave protects comments globally
When a photo belongs to a frozen wave, the system SHALL prevent adding or deleting comments on that photo, even from the global feed.

#### Scenario: createComment blocked for photo in frozen wave
- **WHEN** `createComment(photoId, uuid, description)` is called and the photo is in a frozen wave
- **THEN** the system SHALL throw an error indicating the photo belongs to a frozen wave and comments cannot be added

#### Scenario: deleteComment blocked for photo in frozen wave
- **WHEN** `deleteComment(commentId, uuid)` is called and the comment's photo is in a frozen wave
- **THEN** the system SHALL throw an error indicating the photo belongs to a frozen wave and comments cannot be removed

#### Scenario: Comments allowed for photo in unfrozen wave
- **WHEN** `createComment` or `deleteComment` is called on a photo in a non-frozen wave
- **THEN** the operation SHALL proceed normally

### Requirement: Wave active state
The system SHALL provide `_isWaveActive(wave)` that returns `true` if the wave is not frozen AND (`startDate IS NULL` OR `NOW() >= startDate`). This determines whether a wave is currently accepting contributions.

#### Scenario: Wave with no dates is active
- **WHEN** `_isWaveActive` is called on a wave with no `startDate`, no `endDate`, and `frozen = false`
- **THEN** the function SHALL return `true`

#### Scenario: Wave before startDate is not active
- **WHEN** `_isWaveActive` is called on a wave with `startDate` in the future
- **THEN** the function SHALL return `false`

#### Scenario: Frozen wave is not active
- **WHEN** `_isWaveActive` is called on a frozen wave
- **THEN** the function SHALL return `false`

### Requirement: Wave response includes computed state fields
The `Wave` GraphQL type SHALL include `isFrozen: Boolean!` (computed from `frozen` and `endDate`) and `isActive: Boolean!` (computed from frozen state and `startDate`).

#### Scenario: Frozen wave response
- **WHEN** a frozen wave is returned in a GraphQL response
- **THEN** `isFrozen` SHALL be `true` and `isActive` SHALL be `false`

#### Scenario: Active wave response
- **WHEN** an active, unfrozen wave with no startDate restriction is returned
- **THEN** `isFrozen` SHALL be `false` and `isActive` SHALL be `true`
