## Context

The backend is a single AWS Lambda behind AWS AppSync (GraphQL). PostgreSQL + PostGIS is the database, accessed via raw parameterized SQL (no ORM). Waves currently exist as a basic grouping mechanism — a `Waves` table with `WavePhotos` (join) and `WaveUsers` (membership) tables. Authorization is a single check: `Waves.createdBy == uuid`. There is no role system, no sharing, no lifecycle management, and no moderation workflow. Users are identified by a client-sent UUID; the optional `Secrets` table provides a nickname+bcrypt-hash identity registration mechanism.

All wave controllers live in `lambda-fns/controllers/waves/`. Photo and comment controllers are in their respective directories. The GraphQL handler (`lambda-fns/index.ts`) dispatches by field name to controller functions. Resolver mappings are in `lib/resources/resolvers.ts`.

## Goals / Non-Goals

**Goals:**
- Implement a three-tier role system (owner/facilitator/contributor) on wave membership
- Support two mutually exclusive wave types: invite-only (token-based) and open (public URL)
- Enable wave lifecycle management: start/end dates, manual freeze/unfreeze
- Enforce frozen wave immutability across the entire system (photos, comments, wave mutations)
- Provide wave-scoped moderation tools (report, dismiss, unlink photos, ban users)
- Enforce geo-boundaries on photo additions
- Require registered secret for wave creation and facilitator assignment
- Generate shareable deep links for both wave types

**Non-Goals:**
- Global (platform-wide) user bans — banning is wave-scoped only
- Push notifications for wave events (joins, bans, etc.)
- Server-side QR code generation — client renders QR from the URL
- Ownership transfer between users
- Real-time collaboration / WebSocket updates
- Web fallback landing page implementation (separate concern)
- Apple/Android app association file setup (app-side configuration)

## Decisions

### 1. Role storage: column on WaveUsers vs. separate roles table

**Decision**: Add a `role` VARCHAR(12) column to `WaveUsers` with values `'owner'`, `'facilitator'`, `'contributor'`.

**Alternatives considered**:
- Separate `WaveRoles` table with FK to `WaveUsers` — adds JOIN complexity for every permission check with no benefit; roles are 1:1 with membership
- Bitmask/integer roles — harder to read in queries, no meaningful space savings

**Rationale**: Simple, readable, one-query permission checks. `VARCHAR(12)` avoids PostgreSQL enum type management across migrations. The role hierarchy is fixed (owner > facilitator > contributor), so a helper function maps role names to numeric levels for comparison.

### 2. Role hierarchy implemented as numeric levels

**Decision**: Shared utility `_getWaveRole(waveUuid, uuid)` returns the role string. `_assertWaveRole(waveUuid, uuid, minRole)` maps roles to levels (`contributor=1, facilitator=2, owner=3`) and throws if the user's level is below the minimum.

**Rationale**: Avoids scattered string comparisons. Adding a new role level in the future only requires updating the mapping.

### 3. Wave type: `open` boolean on Waves table

**Decision**: A single `open` BOOLEAN field on `Waves` controls the wave type. When `open=true`, the join URL is deterministic (`{DEEP_LINK_BASE_URL}/wave/join/{waveUuid}`). When `open=false`, join requires a valid invite token. The two modes are mutually exclusive — `createWaveInvite` rejects if wave is open.

**Alternatives considered**:
- Separate `WaveType` enum (`'invite-only'`, `'open'`) — semantically equivalent to a boolean for two values; a boolean is simpler
- Allow both modes simultaneously — user explicitly requested mutually exclusive

**Rationale**: Boolean is the simplest representation. The deterministic URL for open waves means no database lookup is needed to generate the share link — it's computed from the `waveUuid`.

### 4. Invite tokens: nanoid-style via crypto.randomBytes

**Decision**: Generate invite tokens using `crypto.randomBytes(16).toString('hex')` producing a 32-character hex string. Store in a `WaveInvites` table with expiry, max uses, and revocation support.

**Alternatives considered**:
- UUID v4 for tokens — longer (36 chars), no benefit over random hex
- Short codes (6 chars) — collision risk, brute-force risk
- JWT tokens — stateless but can't be revoked without a blacklist, and we need usage counting

**Rationale**: 32 hex chars provide 128 bits of entropy (brute-force resistant). Stateful tokens in the database allow revocation and usage tracking. No new dependencies needed.

### 5. Freeze semantics: `frozen` boolean + `endDate` auto-freeze

**Decision**: Two mechanisms: `frozen` (manual toggle by owner) and `endDate` (automatic freeze when past). Effective frozen state: `wave.frozen = true OR (wave.endDate IS NOT NULL AND NOW() > wave.endDate)`. To unfreeze an auto-frozen wave, the owner sets `frozen = false` AND clears/extends `endDate`.

**Rationale**: Separating manual and automatic freeze avoids state conflicts. The owner always has control. When updating a frozen wave, only `frozen` and `endDate` field changes are allowed — all other field changes are rejected.

### 6. Frozen wave protection is cross-cutting

**Decision**: A shared utility `_isPhotoInFrozenWave(photoId)` is used by `deletePhoto`, `createComment`, and `deleteComment` controllers outside the waves domain. This is a single SQL query (JOIN WavePhotos → Waves, check frozen conditions).

**Alternatives considered**:
- Trigger-based enforcement in PostgreSQL — harder to test, error messages less controllable, mixes business logic into DB layer
- Middleware/decorator pattern — the dispatch model (switch statement in index.ts) doesn't support middleware

**Rationale**: Explicit guard calls in each controller are consistent with the existing pattern (e.g., `assertValidUuid` calls). The query is cheap (indexed JOIN on primary keys).

### 7. Geo-boundary enforcement: PostGIS ST_DWithin

**Decision**: When a wave has `location` and `radius` set, `addPhotoToWave` uses `ST_DWithin(photo.location::geography, wave.location::geography, wave.radius * 1000)` to check distance (radius stored in km, ST_DWithin uses meters). Photos without location data are rejected from geo-bounded waves.

**Rationale**: PostGIS geography type handles Earth curvature correctly. The distance check is a single indexed query. Strict rejection of no-GPS photos prevents confusion.

### 8. Moderation: unlink-only photo removal

**Decision**: When a facilitator or owner removes a photo from a wave (`removePhotoFromWave` or via ban), the photo is only unlinked from the wave (WavePhotos row deleted). The photo remains `active=true` in the global feed.

**Rationale**: User explicitly requested that all wave photos remain visible in the global feed. Wave moderation should not affect global visibility. Global moderation (via `deletePhoto` / abuse report threshold) is a separate concern.

### 9. Ban implementation: WaveBans table + cascade cleanup

**Decision**: `banUserFromWave` inserts into `WaveBans`, deletes from `WaveUsers`, and deletes all of the banned user's `WavePhotos` entries for that wave — all in a single transaction. `joinWaveByInvite` and `joinOpenWave` check `WaveBans` before allowing join. Banning is blocked on frozen waves (frozen = truly immutable).

**Rationale**: Clean break as requested. Transaction ensures atomicity. Ban check on join prevents re-entry.

### 10. Secret requirement enforcement

**Decision**: `_assertHasSecret(uuid)` queries `SELECT 1 FROM "Secrets" WHERE uuid = $1`. Required for `createWave`, `autoGroupPhotosIntoWaves`, and checked on the target user for `assignFacilitator`.

**Rationale**: Ensures wave creators and facilitators have recoverable identities. Lightweight check — single indexed query.

### 11. `deletePhoto` updates wave photosCount

**Decision**: After soft-deleting a photo, `deletePhoto` queries `WavePhotos` to find if the photo was in a wave, and if so, calls `_updatePhotosCount(waveUuid)`.

**Rationale**: A photo can be in at most one wave. Without this, wave `photosCount` becomes stale when photos are deleted globally from non-frozen waves.

### 12. removePhotoFromWave tiered permissions

**Decision**: Single endpoint with role-aware behavior rather than separate `deleteWavePhoto` mutation:
- Owner: always allowed (even on frozen waves — explicit override)
- Facilitator: allowed on unfrozen waves only, any photo
- Contributor: allowed on unfrozen waves only, own photos only

**Rationale**: Avoids API surface area bloat. One endpoint, one mental model. The existing `removePhotoFromWave` mutation name is reused with expanded semantics.

### 13. Auto-grouped waves created frozen

**Decision**: `autoGroupPhotosIntoWaves` sets `frozen=true` and `open=false` on newly created waves.

**Rationale**: Auto-grouped waves are historical archives. Users must explicitly unfreeze to modify.

## Risks / Trade-offs

- **[Cross-cutting freeze check adds latency to every photo delete and comment operation]** → The `_isPhotoInFrozenWave` query is a simple indexed JOIN. Expected <1ms. Acceptable trade-off for data integrity.
- **[Breaking change to `deletePhoto`, `createComment`, `deleteComment`]** → Existing clients will receive errors for photos in frozen waves. Since auto-grouped waves are frozen by default, this will immediately affect users who auto-grouped. Mitigation: the error message is descriptive; clients should handle gracefully.
- **[No cascading freeze on `deleteWave`]** → When an owner deletes a frozen wave, the photos become unfrozen (no longer in any wave). This is intentional — the wave's deletion removes the immutability contract.
- **[Invite token brute-force]** → 128-bit tokens are computationally infeasible to brute-force. Rate limiting at the API Gateway level provides additional protection.
- **[Open wave UUID in URL is guessable if waveUuid is known]** → Open waves are intentionally public. The `open` flag is the access control, not URL obscurity.
- **[Single Lambda handles all operations]** → No change from current architecture. All new controllers run in the same Lambda. If cold start latency increases due to code size, this is a future optimization (not in scope).

## Migration Plan

1. **Deploy migrations first** (6 migrations in sequence): add role column, populate roles, add wave scheduling columns, create WaveInvites, create WaveBans, add abuse report columns. All migrations are additive (new columns with defaults, new tables) — no destructive changes.
2. **Deploy code changes**: All new controllers + modified controllers deploy together. The `frozen` default is `false` and `open` default is `false`, so existing waves behave identically until explicitly modified.
3. **Exception**: Auto-grouped waves created after deployment will be frozen. Clients need to handle the "photo in frozen wave" error for operations on auto-grouped wave photos.
4. **Rollback**: Remove new code, migrations are safe to leave in place (extra columns/tables are ignored). To fully rollback, run migration `down` methods in reverse order.
5. **`DEEP_LINK_BASE_URL` environment variable** must be set before deployment. Add to CDK stack environment configuration.
