## ADDED Requirements

### Requirement: Register a new identity
The system SHALL allow a device to register a persistent anonymous identity using a globally unique nickName and a secret passphrase, tied to a client-generated UUID.

#### Scenario: New identity registered
- **WHEN** `registerSecret(uuid, nickName, secret)` is called and no record with that nickName exists
- **THEN** a Secret record is created with the provided UUID, the nickName, and the bcrypt-hashed secret; the new record (without the secret) is returned

#### Scenario: NickName format validation
- **WHEN** `registerSecret` is called with a nickName shorter than 5 characters or containing invalid characters
- **THEN** the system throws a validation error and no record is created

#### Scenario: NickName already taken — credentials match (existing account)
- **WHEN** `registerSecret` is called with a nickName that already exists and the provided secret matches the stored hash
- **THEN** the system returns the existing Secret record (the UUID on record, not the submitted UUID)

#### Scenario: NickName already taken — credentials do not match
- **WHEN** `registerSecret` is called with a nickName that already exists but the secret does not match the stored hash
- **THEN** the system throws an authentication error

#### Scenario: UUID format validation
- **WHEN** `registerSecret` is called with a `uuid` that is not a valid UUID v4
- **THEN** the system throws an error and no record is created

---

### Requirement: Update secret passphrase
The system SHALL allow an authenticated identity to change their secret passphrase by providing their current secret.

#### Scenario: Secret updated with correct current secret
- **WHEN** `updateSecret(uuid, nickName, secret, newSecret)` is called with a matching current secret
- **THEN** the hashed secret is replaced with the hash of `newSecret` and the updated Secret record is returned

#### Scenario: Update rejected with wrong current secret
- **WHEN** `updateSecret` is called with an incorrect current secret
- **THEN** the system throws an authentication error and the secret is not changed

---

### Requirement: Secrets are stored hashed
The system SHALL never store plaintext secrets; all secrets MUST be stored as bcrypt hashes.

#### Scenario: Secret is hashed before storage
- **WHEN** a secret is registered or updated
- **THEN** only the bcrypt hash of the secret is persisted; the original plaintext value is never written to the database
