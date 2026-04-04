## Why

Waves currently have no access control beyond "only the creator can update/delete." All wave members are equal, there is no sharing mechanism to invite others, no way to freeze a wave to preserve its content, and no moderation tools for managing abusive content within a wave. This limits waves to single-user photo albums. To support collaborative and event-based use cases (conferences, weddings, group trips), waves need a permissions model, sharing infrastructure, lifecycle management, and moderation capabilities.

## What Changes

- **Role-based permissions**: Add `owner`, `facilitator`, and `contributor` roles to wave membership. Owner controls wave configuration and can override freeze. Facilitators moderate content and create invites. Contributors join, add photos, and report content.
- **Two wave types** (mutually exclusive): Invite-only waves require unique invite tokens sent to specific people. Open waves have a public join URL anyone can use. Toggling between types is owner-only.
- **Wave sharing**: Owners (and facilitators for invite-only waves) can generate invite tokens with optional expiry and usage limits. Invite tokens produce deep links and QR codes. Open waves have a deterministic join URL based on `waveUuid`.
- **Deep links**: Universal Links (iOS) + App Links (Android) with web fallback for app-not-installed case. Two URL patterns: `/wave/invite/{token}` for invite-only, `/wave/join/{waveUuid}` for open.
- **Wave lifecycle / freezing**: Add `startDate`, `endDate`, and `frozen` fields. Waves auto-freeze past `endDate`. Owner can manually freeze/unfreeze via `updateWave`. Auto-grouped waves are created in frozen state.
- **Frozen wave protection**: Photos in frozen waves cannot be deleted globally, comments on photos in frozen waves cannot be added or deleted (even from the global feed). Owner can override to remove photos from frozen waves. **BREAKING**: `deletePhoto`, `createComment`, and `deleteComment` mutations will now reject operations on photos belonging to frozen waves.
- **Geo-boundary enforcement**: When a wave has location + radius set, `addPhotoToWave` rejects photos outside the boundary. Photos without GPS data are rejected from geo-bounded waves.
- **Moderation**: Wave-scoped abuse reports with review workflow. Facilitators and owners can dismiss reports, remove photos from waves (unlink only — photo stays in global feed), and ban users from waves (wave-scoped, removes their photos from the wave).
- **Secret requirement**: Creating waves and being assigned as facilitator require a registered secret (identity via the Secrets table).
- **Contributor photo management**: Contributors can remove their own photos from unfrozen waves. Moving a photo to a different wave respects freeze on the source wave.
- **Global photo delete updates wave counts**: `deletePhoto` now updates `photosCount` for any wave the deleted photo belonged to.

## Capabilities

### New Capabilities
- `wave-roles`: Role-based permission model (owner/facilitator/contributor) for wave membership, including shared guard utilities for role checking, freeze checking, ban checking, geo-boundary checking, and secret requirement checking
- `wave-sharing`: Invite token creation/revocation, join-by-invite, join-open-wave, deep link URL generation for both wave types
- `wave-lifecycle`: Start/end date scheduling, manual freeze/unfreeze, auto-freeze at endDate, auto-grouped waves created frozen, frozen state enforcement across all wave mutations
- `wave-moderation`: Wave-scoped abuse reports with status tracking, report dismissal, photo removal from waves (unlink only), user banning with photo cleanup, ban enforcement on join and photo add

### Modified Capabilities
- `waves`: `createWave` requires secret. `updateWave` gains `open`, `frozen`, `startDate`, `endDate` fields and enforces owner-only role check. `deleteWave` allowed even when frozen. `addPhotoToWave` adds guard chain (member check, freeze check, geo-bounds, ban check). `removePhotoFromWave` gains tiered role permissions (owner overrides freeze, facilitator requires unfrozen, contributor can remove own photo from unfrozen wave). `mergeWaves` requires owner of both + neither frozen.
- `auto-group-photos`: Auto-grouped waves are created in frozen state. `autoGroupPhotosIntoWaves` requires a registered secret.
- `comments`: `createComment` and `deleteComment` reject operations when the target photo belongs to a frozen wave.
- `abuse-reports`: AbuseReports gain `waveUuid`, `status`, `reviewedBy`, `reviewedAt` columns for wave-scoped moderation workflow.
- `remove-photo-from-wave`: `removePhotoFromWave` gains role-based permission checks — owner can always remove (even frozen), facilitator can remove from unfrozen waves, contributor can remove own photo from unfrozen waves.
- `wave-merge`: `mergeWaves` adds freeze checks — both source and target must be unfrozen.

## Impact

- **Database**: 6 new migrations — add `role` to `WaveUsers`, add `open`/`frozen`/`startDate`/`endDate` to `Waves`, create `WaveInvites` table, create `WaveBans` table, add wave context columns to `AbuseReports`, populate existing wave roles
- **GraphQL schema**: Modified `Wave` type (6 new fields), 3 new types (`WaveInvite`, `WaveMember`, `WaveBan`), 4 new queries, 11 new mutations, modified `updateWave` arguments
- **Lambda controllers**: ~27 new files (13 controllers + 4 queries + 8 utilities + model updates), ~16 modified files (7 wave controllers + 3 cross-cutting controllers + schema + resolvers + index + model)
- **Cross-cutting**: `deletePhoto`, `createComment`, `deleteComment` gain frozen-wave guard — this is a **breaking behavioral change** for clients that expect unconditional success
- **Environment**: New `DEEP_LINK_BASE_URL` environment variable for generating share URLs
- **No new npm dependencies required** — invite tokens can use Node.js `crypto.randomBytes`
