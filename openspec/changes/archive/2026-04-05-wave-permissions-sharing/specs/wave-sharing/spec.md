## ADDED Requirements

### Requirement: Create invite token for invite-only waves
The system SHALL allow owners and facilitators to create invite tokens for invite-only waves via `createWaveInvite(waveUuid, uuid, expiresAt?, maxUses?)`. The token SHALL be generated using `crypto.randomBytes(16).toString('hex')` producing a 32-character hex string. The system SHALL reject invite creation if the wave is open (`open = true`).

#### Scenario: Invite created for invite-only wave
- **WHEN** `createWaveInvite(waveUuid, uuid)` is called by an owner or facilitator on a wave with `open = false`
- **THEN** a `WaveInvites` record SHALL be created with a random 32-char hex token, `active = true`, `useCount = 0`, and the response SHALL include the token, a `deepLink` URL (`{DEEP_LINK_BASE_URL}/wave/invite/{inviteToken}`), and metadata

#### Scenario: Invite with expiry and max uses
- **WHEN** `createWaveInvite` is called with `expiresAt` and `maxUses` arguments
- **THEN** the `WaveInvites` record SHALL store the provided `expiresAt` timestamp and `maxUses` limit

#### Scenario: Invite rejected for open wave
- **WHEN** `createWaveInvite` is called on a wave with `open = true`
- **THEN** the system SHALL throw an error indicating invite tokens are not used for open waves

#### Scenario: Contributor cannot create invite
- **WHEN** `createWaveInvite` is called by a contributor
- **THEN** the system SHALL throw an error indicating insufficient permissions

### Requirement: Revoke invite token
The system SHALL allow owners and facilitators to revoke an invite token via `revokeWaveInvite(inviteToken, uuid)`.

#### Scenario: Invite revoked
- **WHEN** `revokeWaveInvite(inviteToken, uuid)` is called by an owner or facilitator of the invite's wave
- **THEN** the `WaveInvites.active` field SHALL be set to `false` and `true` SHALL be returned

#### Scenario: Non-member cannot revoke
- **WHEN** `revokeWaveInvite` is called by a user who is not an owner or facilitator of the wave
- **THEN** the system SHALL throw an error indicating insufficient permissions

### Requirement: List invite tokens
The system SHALL provide a `listWaveInvites(waveUuid, uuid)` query returning all invite tokens for a wave. Only owners and facilitators SHALL be able to list invites.

#### Scenario: Invites listed
- **WHEN** `listWaveInvites(waveUuid, uuid)` is called by an owner or facilitator
- **THEN** all `WaveInvites` records for the wave SHALL be returned with `inviteToken`, `deepLink`, `expiresAt`, `maxUses`, `useCount`, `active`, and `createdAt`

#### Scenario: Contributor cannot list invites
- **WHEN** `listWaveInvites` is called by a contributor
- **THEN** the system SHALL throw an error indicating insufficient permissions

### Requirement: Join wave by invite token
The system SHALL allow any user to join a wave via `joinWaveByInvite(inviteToken, uuid)`. The system SHALL validate the token and add the user as a contributor.

#### Scenario: Successful join by invite
- **WHEN** `joinWaveByInvite(inviteToken, uuid)` is called with a valid, active, non-expired token that has not reached maxUses, and the user is not banned from the wave
- **THEN** a `WaveUsers` record SHALL be created with `role = 'contributor'`, the token's `useCount` SHALL be incremented, and the Wave SHALL be returned

#### Scenario: Already a member — idempotent
- **WHEN** `joinWaveByInvite` is called by a user already in `WaveUsers` for that wave
- **THEN** the insert SHALL be ON CONFLICT DO NOTHING, `useCount` SHALL still be incremented, and the Wave SHALL be returned

#### Scenario: Expired token rejected
- **WHEN** `joinWaveByInvite` is called with a token whose `expiresAt` is in the past
- **THEN** the system SHALL throw an error indicating the invite has expired

#### Scenario: Max uses reached
- **WHEN** `joinWaveByInvite` is called with a token whose `useCount >= maxUses`
- **THEN** the system SHALL throw an error indicating the invite has reached its maximum uses

#### Scenario: Revoked token rejected
- **WHEN** `joinWaveByInvite` is called with a token where `active = false`
- **THEN** the system SHALL throw an error indicating the invite has been revoked

#### Scenario: Banned user rejected
- **WHEN** `joinWaveByInvite` is called by a user who has a record in `WaveBans` for that wave
- **THEN** the system SHALL throw an error indicating the user is banned from this wave

### Requirement: Join open wave
The system SHALL allow any user to join an open wave via `joinOpenWave(waveUuid, uuid)`. The wave MUST have `open = true`.

#### Scenario: Successful join of open wave
- **WHEN** `joinOpenWave(waveUuid, uuid)` is called on a wave with `open = true` and the user is not banned
- **THEN** a `WaveUsers` record SHALL be created with `role = 'contributor'` and the Wave SHALL be returned

#### Scenario: Non-open wave rejected
- **WHEN** `joinOpenWave` is called on a wave with `open = false`
- **THEN** the system SHALL throw an error indicating the wave is not open for public joining

#### Scenario: Banned user rejected
- **WHEN** `joinOpenWave` is called by a user with a `WaveBans` record for that wave
- **THEN** the system SHALL throw an error indicating the user is banned from this wave

#### Scenario: Already a member — idempotent
- **WHEN** `joinOpenWave` is called by a user already in `WaveUsers`
- **THEN** the insert SHALL be ON CONFLICT DO NOTHING and the Wave SHALL be returned

### Requirement: Deep link URL generation
The system SHALL generate deep link URLs for sharing. For invite-only waves, the URL format SHALL be `{DEEP_LINK_BASE_URL}/wave/invite/{inviteToken}`. For open waves, the URL format SHALL be `{DEEP_LINK_BASE_URL}/wave/join/{waveUuid}`. The `DEEP_LINK_BASE_URL` SHALL be read from the `DEEP_LINK_BASE_URL` environment variable.

#### Scenario: Invite deep link included in WaveInvite response
- **WHEN** a `WaveInvite` is returned from `createWaveInvite` or `listWaveInvites`
- **THEN** the `deepLink` field SHALL contain `{DEEP_LINK_BASE_URL}/wave/invite/{inviteToken}`

#### Scenario: Open wave join URL included in Wave response
- **WHEN** a Wave with `open = true` is returned
- **THEN** the `joinUrl` field SHALL contain `{DEEP_LINK_BASE_URL}/wave/join/{waveUuid}`

#### Scenario: Closed wave has no joinUrl
- **WHEN** a Wave with `open = false` is returned
- **THEN** the `joinUrl` field SHALL be `null`

### Requirement: Ban check on join
The system SHALL check the `WaveBans` table before allowing any user to join a wave. A shared utility `_assertNotBanned(waveUuid, uuid)` SHALL query `SELECT 1 FROM "WaveBans" WHERE "waveUuid" = $1 AND "uuid" = $2` and throw if a record exists.

#### Scenario: Banned user cannot join by invite
- **WHEN** a banned user attempts `joinWaveByInvite`
- **THEN** the system SHALL throw an error before creating the `WaveUsers` record

#### Scenario: Banned user cannot join open wave
- **WHEN** a banned user attempts `joinOpenWave`
- **THEN** the system SHALL throw an error before creating the `WaveUsers` record

#### Scenario: Non-banned user passes check
- **WHEN** `_assertNotBanned` is called for a user with no `WaveBans` record
- **THEN** the function SHALL return without error
