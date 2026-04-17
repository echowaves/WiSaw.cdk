## ADDED Requirements

### Requirement: createWave enforces ownership bootstrap and date rules
`createWave` requires caller identity in `Secrets`, creates wave with `open=false`, inserts creator as `owner` in `WaveUsers`, and enforces `freezeDate > splashDate` when both are present.

#### Scenario: Creator is auto-assigned owner role
- **WHEN** wave creation succeeds
- **THEN** caller is added to `WaveUsers` as `owner`

#### Scenario: Date ordering validation fails
- **WHEN** `freezeDate` is earlier than or equal to `splashDate` where disallowed
- **THEN** create request fails

### Requirement: updateWave is owner-only with frozen restrictions
`updateWave` is owner-only. On frozen waves, only `freezeDate` updates are allowed. Optional `null` and `undefined` inputs are treated as not provided; empty description string clears description.

#### Scenario: Non-owner update rejected
- **WHEN** facilitator or contributor calls `updateWave`
- **THEN** request fails with permission error

#### Scenario: Frozen wave allows freezeDate-only update
- **WHEN** wave is frozen and payload only changes `freezeDate`
- **THEN** update proceeds

#### Scenario: Empty description clears stored value
- **WHEN** owner sets description to empty string
- **THEN** description is stored as null/cleared

### Requirement: listWaves returns paginated membership waves with computed fields
`listWaves` returns waves for caller membership including photos preview, persisted `photosCount`, computed `isFrozen`, `myRole`, and `joinUrl` behavior.

#### Scenario: Membership-scoped list
- **WHEN** user requests waves
- **THEN** only waves with matching `WaveUsers` membership are returned

#### Scenario: Open wave includes joinUrl
- **WHEN** returned wave has `open=true`
- **THEN** response includes non-null join URL

### Requirement: addPhotoToWave supports idempotent add and cross-wave move
`addPhotoToWave` enforces membership/ban/geo/frozen checks. If photo is already in target wave, call is idempotent. If photo is in another wave, it is auto-moved when allowed; move is blocked when source wave is frozen unless caller is source owner.

#### Scenario: Idempotent add to same wave
- **WHEN** photo already linked to target wave
- **THEN** call succeeds without duplicate link creation

#### Scenario: Auto-move across waves
- **WHEN** photo belongs to another mutable wave
- **THEN** link is moved to target wave and affected counts are updated

#### Scenario: Move blocked by frozen source wave
- **WHEN** source wave is frozen and caller is not source owner
- **THEN** add/move request fails

### Requirement: removePhotoFromWave is role-based
Owner may always remove. Facilitator and contributor permissions depend on unfrozen state and ownership rules. `photosCount` is updated after removal.

#### Scenario: Contributor can remove own photo on mutable wave
- **WHEN** contributor removes a photo they added and wave is not frozen
- **THEN** removal succeeds

#### Scenario: Contributor cannot remove others photo
- **WHEN** contributor targets another member's photo link
- **THEN** removal fails

### Requirement: graph operations include auto-group and waves count
`autoGroupPhotosIntoWaves` and `getWavesCount` are exposed and follow current controller behavior and return shapes.

#### Scenario: GetWavesCount Validates UUID Before SQL
- **WHEN** uuid is malformed
- **THEN** request fails before DB query