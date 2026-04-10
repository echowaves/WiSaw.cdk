### Requirement: Wave membership includes a role
The system SHALL store a `role` field on each `WaveUsers` record with one of three values: `'owner'`, `'facilitator'`, or `'contributor'`. The default role for new members SHALL be `'contributor'`.

#### Scenario: New member gets contributor role
- **WHEN** a user joins a wave via any join mechanism
- **THEN** the `WaveUsers` record SHALL have `role = 'contributor'`

#### Scenario: Wave creator gets owner role
- **WHEN** a wave is created via `createWave`
- **THEN** the creator's `WaveUsers` record SHALL have `role = 'owner'`

### Requirement: Role hierarchy for permission checks
The system SHALL enforce a role hierarchy where `owner` (level 3) > `facilitator` (level 2) > `contributor` (level 1). A shared utility `_assertWaveRole(waveUuid, uuid, minRole)` SHALL throw an error if the user's role level is below the required minimum.

#### Scenario: Owner passes any role check
- **WHEN** `_assertWaveRole(waveUuid, uuid, 'facilitator')` is called for an owner
- **THEN** the check SHALL pass without error

#### Scenario: Contributor fails facilitator check
- **WHEN** `_assertWaveRole(waveUuid, uuid, 'facilitator')` is called for a contributor
- **THEN** the system SHALL throw an error indicating insufficient permissions

#### Scenario: Non-member fails any check
- **WHEN** `_assertWaveRole(waveUuid, uuid, 'contributor')` is called for a UUID not in `WaveUsers`
- **THEN** the system SHALL throw an error indicating the user is not a member of the wave

### Requirement: Get wave role utility
The system SHALL provide a `_getWaveRole(waveUuid, uuid)` utility that returns the user's role string (`'owner'`, `'facilitator'`, or `'contributor'`) or `null` if the user is not a member.

#### Scenario: Member role returned
- **WHEN** `_getWaveRole(waveUuid, uuid)` is called for a facilitator member
- **THEN** the function SHALL return `'facilitator'`

#### Scenario: Non-member returns null
- **WHEN** `_getWaveRole(waveUuid, uuid)` is called for a UUID not in `WaveUsers` for that wave
- **THEN** the function SHALL return `null`

### Requirement: Assign facilitator role
The system SHALL allow the wave owner to promote a contributor to facilitator via `assignFacilitator(waveUuid, targetUuid, uuid)`. The target user MUST already be a member of the wave and MUST have a registered secret.

#### Scenario: Contributor promoted to facilitator
- **WHEN** `assignFacilitator(waveUuid, targetUuid, uuid)` is called by the owner and the target is a contributor with a registered secret
- **THEN** the target's `WaveUsers.role` SHALL be updated to `'facilitator'` and `true` SHALL be returned

#### Scenario: Non-owner cannot assign facilitator
- **WHEN** `assignFacilitator` is called by a facilitator or contributor
- **THEN** the system SHALL throw an error indicating insufficient permissions

#### Scenario: Target without secret rejected
- **WHEN** `assignFacilitator` is called and the target user has no record in the `Secrets` table
- **THEN** the system SHALL throw an error indicating the target must register an identity

#### Scenario: Target not a member rejected
- **WHEN** `assignFacilitator` is called and the target UUID is not in `WaveUsers` for that wave
- **THEN** the system SHALL throw an error indicating the target is not a wave member

### Requirement: Remove facilitator role
The system SHALL allow the wave owner to demote a facilitator to contributor via `removeFacilitator(waveUuid, targetUuid, uuid)`.

#### Scenario: Facilitator demoted to contributor
- **WHEN** `removeFacilitator(waveUuid, targetUuid, uuid)` is called by the owner
- **THEN** the target's `WaveUsers.role` SHALL be updated to `'contributor'` and `true` SHALL be returned

#### Scenario: Non-owner cannot remove facilitator
- **WHEN** `removeFacilitator` is called by a non-owner
- **THEN** the system SHALL throw an error indicating insufficient permissions

### Requirement: Remove user from wave
The system SHALL allow the wave owner to remove any non-owner member from an unfrozen wave via `removeUserFromWave(waveUuid, targetUuid, uuid)`. Removing a user SHALL also unlink all of their photos from the wave and update `photosCount`.

#### Scenario: User removed from wave
- **WHEN** `removeUserFromWave(waveUuid, targetUuid, uuid)` is called by the owner on an unfrozen wave
- **THEN** the target's `WaveUsers` record SHALL be deleted, all their `WavePhotos` entries for that wave SHALL be deleted, `photosCount` SHALL be recalculated, and `true` SHALL be returned

#### Scenario: Cannot remove owner
- **WHEN** `removeUserFromWave` is called with the owner's UUID as `targetUuid`
- **THEN** the system SHALL throw an error indicating the owner cannot be removed

#### Scenario: Cannot remove from frozen wave
- **WHEN** `removeUserFromWave` is called on a frozen wave
- **THEN** the system SHALL throw an error indicating the wave is frozen

### Requirement: List wave members
The system SHALL provide a `listWaveMembers(waveUuid, uuid)` query that returns all wave members with their UUID, role, and join date. Only owners and facilitators SHALL be able to list members.

#### Scenario: Members listed by facilitator
- **WHEN** `listWaveMembers(waveUuid, uuid)` is called by a facilitator
- **THEN** all `WaveUsers` records for the wave SHALL be returned with `uuid`, `role`, and `createdAt` fields. If a member has a registered secret, their `nickName` SHALL be included.

#### Scenario: Contributor cannot list members
- **WHEN** `listWaveMembers` is called by a contributor
- **THEN** the system SHALL throw an error indicating insufficient permissions

### Requirement: Wave response includes caller's role
The `Wave` GraphQL type SHALL include a `myRole` field that returns the requesting user's role in the wave, or `null` if they are not a member.

#### Scenario: Owner sees their role
- **WHEN** an owner queries a Wave
- **THEN** the `myRole` field SHALL be `'owner'`

#### Scenario: Non-member sees null
- **WHEN** a non-member queries a Wave
- **THEN** the `myRole` field SHALL be `null`

### Requirement: Secret required for wave creation
The system SHALL require the requesting user to have a registered secret (a record in the `Secrets` table) before creating a wave. A shared utility `_assertHasSecret(uuid)` SHALL query `SELECT 1 FROM "Secrets" WHERE uuid = $1` and throw if no record exists.

#### Scenario: User with secret can create wave
- **WHEN** `createWave` is called by a user with a registered secret
- **THEN** the wave SHALL be created normally

#### Scenario: User without secret cannot create wave
- **WHEN** `createWave` is called by a user with no record in the `Secrets` table
- **THEN** the system SHALL throw an error indicating the user must register an identity first

#### Scenario: assertHasSecret utility
- **WHEN** `_assertHasSecret(uuid)` is called with a UUID that has no `Secrets` record
- **THEN** the function SHALL throw an error with a descriptive message
