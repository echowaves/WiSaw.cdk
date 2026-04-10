## MODIFIED Requirements

### Requirement: Update a Wave
The system SHALL allow the Wave owner to update its name, description, location, radius, open status, splashDate, and freezeDate. Only users with `role = 'owner'` in `WaveUsers` SHALL be able to update. When the wave is frozen (current time is past `freezeDate` or before `splashDate`), only `freezeDate` changes SHALL be allowed. To unfreeze a wave, the owner sets `freezeDate` to a future date.

The resolver SHALL treat both `null` and `undefined` values as "field not provided" — the field SHALL NOT be updated in the database. Only non-null values SHALL be treated as intentional updates.

For the `description` field specifically: an empty string (`""`) SHALL clear the description by writing `NULL` to the database. Any other non-null string SHALL update the description to that value.

The returned Wave object SHALL include computed fields: `isFrozen` (derived from the updated `splashDate`/`freezeDate`), `myRole` (always `'owner'` since only owners can update), and `joinUrl` (the deep link URL if the wave is open, otherwise `null`).

#### Scenario: Wave updated by owner
- **WHEN** `updateWave(waveUuid, uuid, name, description, lat, lon, radius)` is called by the owner on an unfrozen wave
- **THEN** the Wave record is updated with the new values and the updated Wave is returned

#### Scenario: Non-owner cannot update
- **WHEN** `updateWave` is called by a facilitator or contributor
- **THEN** the system SHALL throw an error indicating insufficient permissions

#### Scenario: Frozen wave — only freezeDate allowed
- **WHEN** `updateWave` is called on a frozen wave with changes to `name`, `description`, `location`, `radius`, `open`, or `splashDate`
- **THEN** the system SHALL throw an error indicating the wave is frozen

#### Scenario: Frozen wave — unfreeze by extending freezeDate
- **WHEN** `updateWave(waveUuid, uuid, freezeDate: <future date>)` is called by the owner on a frozen wave
- **THEN** the wave SHALL be unfrozen (accepting contributions again)

#### Scenario: Owner toggles wave to open
- **WHEN** `updateWave(waveUuid, uuid, open: true)` is called by the owner
- **THEN** `Waves.open` SHALL be set to `true`

#### Scenario: Owner sets splash and freeze dates
- **WHEN** `updateWave(waveUuid, uuid, splashDate: <date>, freezeDate: <later date>)` is called by the owner on an unfrozen wave
- **THEN** `Waves.splashDate` and `Waves.freezeDate` SHALL be updated

#### Scenario: Null fields treated as not provided
- **WHEN** `updateWave` is called with optional fields set to `null` (e.g., from undeclared GraphQL variables)
- **THEN** those fields SHALL NOT be updated in the database — the existing values SHALL be preserved

#### Scenario: Frozen wave not rejected by leaked nulls
- **WHEN** `updateWave(waveUuid, uuid, freezeDate: <future date>)` is called on a frozen wave but other fields arrive as `null` from undeclared variables
- **THEN** the system SHALL treat the null fields as not provided and allow the freezeDate-only update

#### Scenario: Description cleared with empty string
- **WHEN** `updateWave(waveUuid, uuid, description: "")` is called by the owner on an unfrozen wave
- **THEN** `Waves.description` SHALL be set to `NULL` in the database

#### Scenario: Description updated with non-empty string
- **WHEN** `updateWave(waveUuid, uuid, description: "new desc")` is called by the owner
- **THEN** `Waves.description` SHALL be set to `"new desc"`

#### Scenario: Description null means no change
- **WHEN** `updateWave(waveUuid, uuid, description: null)` is called by the owner
- **THEN** `Waves.description` SHALL NOT be changed

#### Scenario: Returned wave includes isFrozen
- **WHEN** `updateWave` completes successfully
- **THEN** the returned Wave object SHALL have `isFrozen` computed from the updated `splashDate` and `freezeDate` values

#### Scenario: Returned wave includes myRole as owner
- **WHEN** `updateWave` completes successfully
- **THEN** the returned Wave object SHALL have `myRole` set to `'owner'`

#### Scenario: Returned wave includes joinUrl when open
- **WHEN** `updateWave` completes successfully and the wave's `open` field is `true`
- **THEN** the returned Wave object SHALL have `joinUrl` set to the deep link URL for the wave

#### Scenario: Returned wave has null joinUrl when not open
- **WHEN** `updateWave` completes successfully and the wave's `open` field is `false`
- **THEN** the returned Wave object SHALL have `joinUrl` set to `null`
