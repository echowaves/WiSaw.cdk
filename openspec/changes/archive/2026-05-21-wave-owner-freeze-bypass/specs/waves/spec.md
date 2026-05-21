## MODIFIED Requirements

### Requirement: updateWave is owner-only with frozen restrictions
`updateWave` is owner-only. On frozen waves, owners MAY update any field including freezeDate and other properties. Non-owners are rejected regardless of freeze state.

#### Scenario: Owner updates frozen wave freely
- **WHEN** the caller is the owner of a frozen wave AND sends any valid update payload
- **THEN** the system SHALL apply all changes without restriction

#### Scenario: Frozen wave allows full update by owner
- **WHEN** wave is frozen and owner changes name, location, or other fields (not just freezeDate)
- **THEN** update proceeds normally

### Requirement: addPhotoToWave supports idempotent add and cross-wave move
`addPhotoToWave` enforces membership/ban/geo/frozen checks. If photo is already in target wave, call is idempotent. If photo is in another wave, it is auto-moved when allowed; move is blocked when source wave is frozen unless caller is source owner. **Owners of the target wave may add photos regardless of freeze state.**

#### Scenario: Owner adds photo to frozen wave
- **WHEN** the caller is the owner of a frozen wave AND calls `addPhotoToWave` for that wave
- **THEN** the system SHALL allow the photo addition without freeze restriction

#### Scenario: Non-owner blocked from adding to frozen wave
- **WHEN** the caller is not the owner and the target wave is frozen
- **THEN** the system SHALL reject with "This wave is frozen and cannot be modified"
