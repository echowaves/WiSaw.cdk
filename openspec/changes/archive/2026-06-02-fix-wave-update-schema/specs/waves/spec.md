## MODIFIED Requirements

### Requirement: updateWave is owner-only with frozen restrictions
`updateWave` is owner-only. On frozen waves, owners MAY update any field including freezeDate and other properties. Non-owners are rejected regardless of freeze state. Optional `null` and `undefined` inputs are treated as not provided; empty description string clears description.

**Schema contract**: The `updateWave` mutation accepts the following optional parameters: `name`, `description`, `lat`, `lon`, `radius`, `groupingLevel`, `open`, `splashDate`, `freezeDate`, `freezeMode`.

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
