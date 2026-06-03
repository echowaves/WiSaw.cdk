## MODIFIED Requirements

### Requirement: createWave enforces ownership bootstrap and date rules
`createWave` requires caller identity in `Secrets`, creates wave with `open=false`, inserts creator as `owner` in `WaveUsers`, and enforces `freezeDate > splashDate` when both are present.

**Schema contract**: The `createWave` mutation accepts parameters `name: String!`, `description: String!`, `uuid: String!`, `lat: Float`, `lon: Float`, `radius: Int`, `groupingLevel: GroupingLevel`, `splashDate: AWSDateTime`, `freezeDate: AWSDateTime` and returns `Wave!`.

#### Scenario: Creator is auto-assigned owner role
- **WHEN** wave creation succeeds
- **THEN** caller is added to `WaveUsers` as `owner`

#### Scenario: Date ordering validation fails
- **WHEN** `freezeDate` is earlier than or equal to `splashDate` where disallowed
- **THEN** create request fails

### Requirement: updateWave is owner-only with frozen restrictions
`updateWave` is owner-only. On frozen waves, owners MAY update any field including freezeDate and other properties. Non-owners are rejected regardless of freeze state. Optional `null` and `undefined` inputs are treated as not provided; empty description string clears description.

**Schema contract**: The `updateWave` mutation accepts the following optional parameters: `name`, `description`, `lat`, `lon`, `radius`, `groupingLevel`, `open`, `splashDate: AWSDateTime`, `freezeDate: AWSDateTime`, `freezeMode: WaveFreezeMode` and returns `Wave!`.

#### Scenario: Owner updates frozen wave freely
- **WHEN** the caller is the owner of a frozen wave AND sends any valid update payload
- **THEN** the system SHALL apply all changes without restriction

#### Scenario: Frozen wave allows full update by owner
- **WHEN** wave is frozen and owner changes name, location, or other fields (not just freezeDate)
- **THEN** update proceeds normally

#### Scenario: Owner updates freezeDate
- **WHEN** owner calls `updateWave` with `freezeDate` parameter
- **THEN** the freezeDate is persisted and the wave's freeze state is updated accordingly

#### Scenario: Owner updates freezeMode
- **WHEN** owner calls `updateWave` with `freezeMode` parameter (e.g., `FROZEN`, `UNFROZEN`, `AUTO`)
- **THEN** the freezeMode is persisted and returned in the updated wave

#### Scenario: Owner updates open flag
- **WHEN** owner calls `updateWave` with `open` parameter
- **THEN** the open flag is persisted and joinUrl is computed accordingly

#### Scenario: Non-owner update rejected
- **WHEN** facilitator or contributor calls `updateWave`
- **THEN** request fails with permission error

#### Scenario: Empty description clears stored value
- **WHEN** owner sets description to empty string
- **THEN** description is stored as null/cleared
