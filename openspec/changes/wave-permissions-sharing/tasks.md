## 1. Database Migrations

- [ ] 1.1 Create migration `20260405120000-add-wave-roles.js`: add `role` VARCHAR(12) NOT NULL DEFAULT 'contributor' column to `WaveUsers` table
- [ ] 1.2 Create migration `20260405120001-populate-wave-roles.js`: set `role = 'owner'` on `WaveUsers` rows where `WaveUsers.uuid = Waves.createdBy`
- [ ] 1.3 Create migration `20260405120002-add-wave-scheduling.js`: add `open` (BOOLEAN DEFAULT FALSE NOT NULL), `frozen` (BOOLEAN DEFAULT FALSE NOT NULL), `startDate` (TIMESTAMP WITH TIME ZONE NULL), `endDate` (TIMESTAMP WITH TIME ZONE NULL) columns to `Waves` table
- [ ] 1.4 Create migration `20260405120003-create-wave-invites.js`: create `WaveInvites` table with `inviteToken` (VARCHAR(32) PK), `waveUuid` (UUID FK → Waves ON DELETE CASCADE), `createdBy` (UUID NOT NULL), `expiresAt` (TIMESTAMP NULL), `maxUses` (INTEGER NULL), `useCount` (INTEGER DEFAULT 0 NOT NULL), `active` (BOOLEAN DEFAULT TRUE NOT NULL), `createdAt` (TIMESTAMP NOT NULL); add index on `waveUuid`
- [ ] 1.5 Create migration `20260405120004-create-wave-bans.js`: create `WaveBans` table with composite PK `(waveUuid, uuid)`, `bannedBy` (UUID NOT NULL), `reason` (TEXT NULL), `createdAt` (TIMESTAMP NOT NULL); FK `waveUuid` → Waves ON DELETE CASCADE
- [ ] 1.6 Create migration `20260405120005-add-abuse-report-wave-context.js`: add `waveUuid` (UUID NULL), `status` (VARCHAR(12) DEFAULT 'pending'), `reviewedBy` (UUID NULL), `reviewedAt` (TIMESTAMP WITH TIME ZONE NULL) columns to `AbuseReports` table

## 2. Shared Utilities

- [ ] 2.1 Create `lambda-fns/controllers/waves/_getWaveRole.ts`: query `WaveUsers` for role, return role string or null
- [ ] 2.2 Create `lambda-fns/controllers/waves/_assertWaveRole.ts`: map roles to numeric levels (contributor=1, facilitator=2, owner=3), throw if user's level < required minimum
- [ ] 2.3 Create `lambda-fns/controllers/waves/_assertNotFrozen.ts`: check `wave.frozen = true` OR (`wave.endDate IS NOT NULL` AND `NOW() > wave.endDate`), throw if frozen
- [ ] 2.4 Create `lambda-fns/controllers/waves/_isWaveFrozen.ts`: pure function returning boolean for frozen state
- [ ] 2.5 Create `lambda-fns/controllers/waves/_isWaveActive.ts`: returns true if not frozen AND (startDate is null OR NOW() >= startDate)
- [ ] 2.6 Create `lambda-fns/controllers/waves/_assertNotBanned.ts`: query `WaveBans` table, throw if record exists
- [ ] 2.7 Create `lambda-fns/controllers/waves/_assertGeoBounds.ts`: use PostGIS `ST_DWithin` to check photo location vs wave boundary, skip if wave has no location
- [ ] 2.8 Create `lambda-fns/controllers/waves/_assertHasSecret.ts`: query `Secrets` table for uuid, throw if no record
- [ ] 2.9 Create `lambda-fns/controllers/waves/_isPhotoInFrozenWave.ts`: query `WavePhotos` JOIN `Waves` to check if photo is in any frozen wave, return boolean

## 3. GraphQL Schema Updates

- [ ] 3.1 Update `Wave` type in `graphql/schema.graphql`: add `open`, `frozen`, `startDate`, `endDate`, `isFrozen`, `isActive`, `myRole`, `joinUrl` fields
- [ ] 3.2 Add `WaveInvite` type to `graphql/schema.graphql`: `inviteToken`, `waveUuid`, `deepLink`, `expiresAt`, `maxUses`, `useCount`, `active`, `createdAt`
- [ ] 3.3 Add `WaveMember` type to `graphql/schema.graphql`: `uuid`, `nickName`, `role`, `createdAt`
- [ ] 3.4 Add `WaveBan` type to `graphql/schema.graphql`: `uuid`, `bannedBy`, `reason`, `createdAt`
- [ ] 3.5 Add new queries to `graphql/schema.graphql`: `listWaveMembers`, `listWaveInvites`, `listWaveAbuseReports`, `listWaveBans`
- [ ] 3.6 Add new mutations to `graphql/schema.graphql`: `createWaveInvite`, `revokeWaveInvite`, `joinWaveByInvite`, `joinOpenWave`, `assignFacilitator`, `removeFacilitator`, `removeUserFromWave`, `reportWavePhoto`, `dismissWaveReport`, `banUserFromWave`
- [ ] 3.7 Update `updateWave` mutation signature in `graphql/schema.graphql`: add `open`, `frozen`, `startDate`, `endDate` optional arguments

## 4. Model Updates

- [ ] 4.1 Update `lambda-fns/models/wave.ts`: add `open`, `frozen`, `startDate`, `endDate`, `isFrozen`, `isActive`, `myRole`, `joinUrl` fields to Wave class

## 5. Modify Existing Wave Controllers

- [ ] 5.1 Modify `lambda-fns/controllers/waves/create.ts`: add `_assertHasSecret(uuid)` check, set `role = 'owner'` on WaveUsers insert
- [ ] 5.2 Modify `lambda-fns/controllers/waves/update.ts`: replace `createdBy` check with `_assertWaveRole(waveUuid, uuid, 'owner')`, add freeze-aware field gating (only allow `frozen`/`endDate` changes on frozen waves), handle new fields (`open`, `frozen`, `startDate`, `endDate`)
- [ ] 5.3 Modify `lambda-fns/controllers/waves/delete.ts`: replace `createdBy` check with `_assertWaveRole(waveUuid, uuid, 'owner')`, allow deletion even when frozen
- [ ] 5.4 Modify `lambda-fns/controllers/waves/addPhoto.ts`: add full guard chain — `_assertNotBanned`, `_getWaveRole` (must be member), `_assertNotFrozen`, `_isWaveActive` (startDate check), `_assertGeoBounds`, check source wave freeze when moving photos
- [ ] 5.5 Modify `lambda-fns/controllers/waves/removePhoto.ts`: add tiered role-based permissions — owner always allowed, facilitator on unfrozen, contributor own-photo on unfrozen
- [ ] 5.6 Modify `lambda-fns/controllers/waves/mergeWaves.ts`: replace `createdBy` checks with `_assertWaveRole` for 'owner' on both waves, add `_assertNotFrozen` checks on both waves
- [ ] 5.7 Modify `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`: add `_assertHasSecret(uuid)`, set `frozen = true` and `open = false` on created waves, set WaveUsers role to 'owner'

## 6. New Wave Controllers — Sharing & Joining

- [ ] 6.1 Create `lambda-fns/controllers/waves/createWaveInvite.ts`: validate role (facilitator+), reject if wave is open, generate token via `crypto.randomBytes(16).toString('hex')`, insert into `WaveInvites`, return invite with deepLink
- [ ] 6.2 Create `lambda-fns/controllers/waves/revokeWaveInvite.ts`: look up invite, validate role (facilitator+) on the invite's wave, set `active = false`
- [ ] 6.3 Create `lambda-fns/controllers/waves/joinWaveByInvite.ts`: validate token (exists, active, not expired, not maxed), `_assertNotBanned`, insert WaveUsers with role='contributor' (ON CONFLICT DO NOTHING), increment useCount, return Wave
- [ ] 6.4 Create `lambda-fns/controllers/waves/joinOpenWave.ts`: validate wave exists and `open = true`, `_assertNotBanned`, insert WaveUsers with role='contributor' (ON CONFLICT DO NOTHING), return Wave

## 7. New Wave Controllers — Roles

- [ ] 7.1 Create `lambda-fns/controllers/waves/assignFacilitator.ts`: `_assertWaveRole` owner, `_assertHasSecret` on target, verify target is member, UPDATE WaveUsers role to 'facilitator'
- [ ] 7.2 Create `lambda-fns/controllers/waves/removeFacilitator.ts`: `_assertWaveRole` owner, UPDATE WaveUsers role to 'contributor'
- [ ] 7.3 Create `lambda-fns/controllers/waves/removeUserFromWave.ts`: `_assertWaveRole` owner, `_assertNotFrozen`, verify target is not owner, DELETE target's WavePhotos + WaveUsers, `_updatePhotosCount`

## 8. New Wave Controllers — Moderation

- [ ] 8.1 Create `lambda-fns/controllers/waves/reportWavePhoto.ts`: verify membership via `_getWaveRole`, insert AbuseReport with waveUuid and status='pending'
- [ ] 8.2 Create `lambda-fns/controllers/waves/dismissWaveReport.ts`: look up report, `_assertWaveRole` facilitator+ on report's wave, `_assertNotFrozen`, update status/reviewedBy/reviewedAt
- [ ] 8.3 Create `lambda-fns/controllers/waves/banUserFromWave.ts`: `_assertWaveRole` facilitator+, `_assertNotFrozen`, verify target is bannable (contributor for facilitator caller, contributor or facilitator for owner caller), transaction: DELETE WavePhotos + DELETE WaveUsers + INSERT WaveBans + `_updatePhotosCount`

## 9. New Wave Controllers — Queries

- [ ] 9.1 Create `lambda-fns/controllers/waves/listWaveMembers.ts`: `_assertWaveRole` facilitator+, query WaveUsers LEFT JOIN Secrets for nickName, return WaveMember list
- [ ] 9.2 Create `lambda-fns/controllers/waves/listWaveInvites.ts`: `_assertWaveRole` facilitator+, query WaveInvites for wave, compute deepLink, return list
- [ ] 9.3 Create `lambda-fns/controllers/waves/listWaveAbuseReports.ts`: `_assertWaveRole` facilitator+, query AbuseReports WHERE waveUuid matches, return list
- [ ] 9.4 Create `lambda-fns/controllers/waves/listWaveBans.ts`: `_assertWaveRole` facilitator+, query WaveBans for wave, return list

## 10. Cross-Cutting Controller Modifications

- [ ] 10.1 Modify `lambda-fns/controllers/photos/delete.ts`: add `_isPhotoInFrozenWave(photoId)` check — reject if true. After soft-delete, query WavePhotos for the photo's wave and call `_updatePhotosCount` if found
- [ ] 10.2 Modify `lambda-fns/controllers/comments/create.ts`: add `_isPhotoInFrozenWave(photoId)` check — reject if true
- [ ] 10.3 Modify `lambda-fns/controllers/comments/delete.ts`: look up photoId from comment, add `_isPhotoInFrozenWave(photoId)` check — reject if true

## 11. Resolver Configuration & Handler Routing

- [ ] 11.1 Update `lib/resources/resolvers.ts`: add resolver mappings for all 4 new queries and 10 new mutations (note: `updateWave` already has a resolver, only new operations need mappings)
- [ ] 11.2 Update `lambda-fns/index.ts`: add case branches for all 4 new queries and 10 new mutations, extract arguments and route to controller functions

## 12. Environment Configuration

- [ ] 12.1 Add `DEEP_LINK_BASE_URL` environment variable to the Lambda configuration in `lib/wi_saw.cdk-stack.ts`

## 13. Update Wave List Query

- [ ] 13.1 Modify `lambda-fns/controllers/waves/listWaves.ts`: include `open`, `frozen`, `startDate`, `endDate` in SELECT; compute `isFrozen`, `isActive`, `myRole` (from WaveUsers.role), and `joinUrl` (if open=true) in the response mapping
