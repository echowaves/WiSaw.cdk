## ADDED Requirements

### Requirement: Register identity by uuid, nickName, and secret
`registerSecret(uuid, nickName, secret)` SHALL validate inputs, use parameterized SQL, and create or resolve identity by nickName.

#### Scenario: New nickName
- **WHEN** nickName is unused and input is valid
- **THEN** a new `Secrets` record is created and returned

#### Scenario: Existing nickName with matching secret
- **WHEN** nickName exists and provided secret hash matches stored hash
- **THEN** existing identity record is returned

#### Scenario: Existing nickName with wrong secret
- **WHEN** nickName exists and secret does not match
- **THEN** request fails

### Requirement: Update secret requires current secret verification
`updateSecret(uuid, nickName, secret, newSecret)` SHALL verify the current secret before persisting the replacement hash.

### Requirement: Secrets are stored hashed with SHA-256
The current implementation stores SHA-256 hashes (from `controllers/secrets/_hash.ts`) and never stores plaintext secrets.

#### Scenario: Register/update stores hash only
- **WHEN** secret values are persisted
- **THEN** only SHA-256 hash is written