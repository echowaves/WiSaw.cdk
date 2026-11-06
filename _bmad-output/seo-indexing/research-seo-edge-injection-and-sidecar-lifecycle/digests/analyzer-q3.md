## What touches a photo's deletion lifecycle @ 3813371

Three separate chains touch it; the app only runs the first, and the third is what actually removes S3 bytes.

### Chain 1 — user request → DB soft delete (no S3 call anywhere in this chain)
- `graphql/schema.graphql:401` (Mutation.deletePhoto) @ 3813371 — declares `deletePhoto(photoId: String!, uuid: String!): String!`. **load-bearing**
- `lib/resources/resolvers.ts:40` (createResolvers fields list) + `:72-77` (fields.forEach → lambdaDs.createResolver) @ 3813371 — binds that field to the single AppSync Lambda data source; no mapping template args.
- `lambda-fns/index.ts:375-383` (exports.main) @ 3813371 — dispatches on `event.info.fieldName`, then `handler.resolver(...handler.getArgs(event.arguments))`.
- `lambda-fns/index.ts:269-272` (deletePhoto mutationHandlers entry) @ 3813371 — `getArgs: (args) => [args.photoId, args.uuid]`; import at `:66`. **load-bearing**
- `lambda-fns/controllers/photos/delete.ts:7` (main) @ 3813371 — the whole user-facing delete. **load-bearing**
  - `:9-10` asserts both ids; `:15-28` frozenCheck query; `:30-33` throws (see checks).
  - `:35-39` UPDATE `"Photos" SET "active" = false WHERE id = $1` — soft delete only, row survives, no rowcount check, returns `'OK'` at `:51` even when zero rows matched. **load-bearing**
  - `:42-47` waveResult → `_updatePhotosCount(waveUuid)` for the first WavePhotos hit (`LIMIT 1`).
- `lambda-fns/controllers/waves/_updatePhotosCount.ts:4` (_updatePhotosCount) @ 3813371 — recomputes `Waves.photosCount`/`updatedAt`/`freezeDate` from rows filtered by `"Photos"."active" = true` (`:15`), so the soft-deleted photo drops out of wave counts. **load-bearing**
- `graphql/schema.graphql:27` (Photo.active) @ 3813371 — the flag itself is exposed on the `Photo` type (`type Photo` at `:18`).

### Chain 2 — S3 object-removed → hard delete of row + objects
- `lib/resources/buckets.ts:51-57` (createBuckets) @ 3813371 — OBJECT_REMOVED on `wisaw-img-<env>`, destination processDeletedImage, filter `{ suffix: '-thumb.webp' }`. This is the *only* trigger for hard deletion; nothing invokes the function in code. **load-bearing**
- `lib/resources/buckets.ts:34` (imgBucket.grantDelete) and `:29-32` (grantReadWrite/grantPut/grantPutAcl/**grantDelete** for processUploadedImage) @ 3813371 — the only S3 delete permissions in the stack.
- `lib/resources/lambdas.ts:130-162` (processDeletedImageLambdaFunction) @ 3813371 — NodejsFunction, entry `lambda-fns/lambdas/processDeletedImage/index.ts` (`:136`), handler `main`, 30s timeout (`:157`), `environment: { ...config }` (`:158-160`) where `config` is the stack config passed at `lib/wi_saw.cdk-stack.ts:25`.
- `lambda-fns/lambdas/processDeletedImage/index.ts:9` (main) @ 3813371 — `:12` `event.Records[0]`, `:13` key, `:17` `photoId = name.replace("-thumb","").replace(".webp","")`, then `Promise.all([_deleteUpload, _deleteSidecar, _cleanupTables])` at `:22-26`. **load-bearing**
  - `:37` `_deleteUpload` → `:48` DeleteObjectCommand with `Key: ${photoId}` (bare id — not `<id>.webp`, which no code path deletes).
  - `:68` `_deleteSidecar` → `:77` `deleteSeoSidecar(client, Bucket, photoId)`; the comment at `:64-67` states the swallow-and-log contract.
  - `:84` `_cleanupTables` — DELETE `"WavePhotos"` `:96-99` (after collecting affected waveUuids `:90-94`, then `_updatePhotosCount` per wave `:101-103`), `"Watchers"` `:110-113`, `"Recognitions"` `:120-123`, `"Comments"` `:130-133`, and last `DELETE from "Photos" WHERE id = $1` `:141-144`. **load-bearing** — the only hard delete of a Photos row in the repo.
  - Each block catches and logs its own error (`:104-107`, `114-117`, `124-127`, `134-137`, `145-148`), so a failed dependent-table delete still reaches the Photos delete, which then fails on the FK and is swallowed — row survives.
- `lambda-fns/utilities/seoSidecar.ts:152-157` (deleteSeoSidecar) @ 3813371 — DeleteObject of `sidecarKey(id)` = `seo/<id>.json`; idempotent on absent key; caller owns error handling.

### Chain 3 — what removes the `-thumb.webp` that starts chain 2 (ops reconciler, not app code)
- `scripts/cleanup-s3.js:80` (getPhotoIds) @ 3813371 — active set is `SELECT "id" FROM "Photos" WHERE "active" = true`, so a photo soft-deleted by chain 1 is *absent* from it. **load-bearing**
- `scripts/cleanup-s3.js:33-44` (classifyKey) @ 3813371 — media key whose leading UUID (`:21-25` extractPhotoId) has no active row → `'delete'`; unrecognized keys → `'report'`, never deleted.
- `scripts/cleanup-s3.js:153-162` + `:187-194` (main) @ 3813371 — DeleteObjectCommand per classified key, i.e. it deletes `<id>-thumb.webp`, which fires the buckets.ts:51 notification and thereby starts chain 2's hard delete. **load-bearing**
- `package.json:19-20` ("cleanup-s3", "cleanup-s3:dry-run") @ 3813371 — only invocation wiring; no EventBridge rule targets it (`lib/resources/lambdas.ts:209-214` schedules cleanupAbuseReports, `:261-266` generateSiteMap).

### Counterpart / adjacent writers (how they touch X)
- `lambda-fns/lambdas/processUploadedImage/index.ts:64` (`_deleteUpload({ Bucket, Key: name })`, `name = <id>.upload` per `:25`) → `:196`/`:206` DeleteObjectCommand of the `.upload` object. That OBJECT_REMOVED has no subscriber (buckets.ts subscribes only `-thumb.webp`), so it does not trigger deletion; `_activatePhoto` `:357-369` sets `active = true`, the inverse of chain 1's write.
- `graphql/schema.graphql:472` (Mutation.removePhotoFromWave) → `lib/resources/resolvers.ts:52` → `lambda-fns/index.ts:317-319` (`[waveUuid, photoId, uuid]`) → `lambda-fns/controllers/waves/removePhoto.ts:56-61` DELETE FROM `"WavePhotos"` + `:63` `_updatePhotosCount`. Detaches from a wave; never touches `Photos.active` or S3.
- Other `"WavePhotos"` row deleters that do **not** delete the photo: `controllers/waves/addPhoto.ts:65`, `banUserFromWave.ts:49`, `delete.ts:17`, `removeUserFromWave.ts:41` (found by grep; not opened).
- `tests/seo-sidecar-lifecycle.js:32` requires `processDeletedImage.main`; `:54-60` builds an S3 event with key `<id>-thumb.webp`; `:109-125` asserts a DeleteObject for `seo/<id>.json`; `:127-145` asserts the handler still returns `true` when the sidecar delete throws; `:62-95` pins the `deleteSeoSidecar` key contract (lowercased id, absent key = success).

### Checks on a delete path that reject or throw
- `lambda-fns/controllers/photos/delete.ts:9` and `:10` → `lambda-fns/utilities/assertValidUuid.ts:14-17` — throws `Wrong UUID format for photoId|uuid: "<value>"` for anything not exactly 36 chars with `-` at 8/13/18/23 and hex elsewhere.
- `lambda-fns/controllers/photos/delete.ts:30-33` — throws `Cannot delete a photo that is in a frozen wave` when the photo is in a wave whose `freezeMode = 'FROZEN'`, or `'AUTO'` with `NOW()` outside `splashDate..freezeDate` (`:21-27`), **and** the caller's `WaveUsers.role` is not `'owner'` (owner override; a caller with no WaveUsers row gets NULL role and is rejected).
- `lambda-fns/controllers/waves/removePhoto.ts:20-23` — throws `You are not a member of this wave` when `_getWaveRole` returns null; `:35-38` and `:41-44` throw `This wave is frozen and cannot be modified` for facilitator/contributor; `:49-52` throws `Insufficient permissions: you can only remove your own photos` when no WavePhotos row exists or `createdBy !== uuid`; uuid asserts at `:13-15`.
- `lambda-fns/controllers/waves/_updatePhotosCount.ts:20` — `return wave.photosCount` throws TypeError when the UPDATE matched no `Waves` row; on the delete path from `delete.ts:46` and `processDeletedImage/index.ts:102`.
- `lambda-fns/lambdas/processDeletedImage/index.ts:12-13` — `event.Records[0]` / `record.s3.object.key` sit *outside* the try at `:16`; an empty batch or missing s3 object throws out of `main`. Everything inside is swallowed at `:29-32`, so `main` returns `true` regardless.
- `scripts/cleanup-s3.js:40-42` (classifyKey) — returns `'report'` for keys not starting with a lowercase UUID, never deletes them; `:133-145` — if the active-id set is empty (DB failure path at `:87-90`), exits before the delete loop; `:120`/`:180-184` — `--dry-run` stops short of any DeleteObject.

### Two patterns doing the same thing (unranked)
- `_deleteUpload` in `processDeletedImage/index.ts:37-62` and in `processUploadedImage/index.ts:196-215`: both build a `DeleteObjectCommand`, new regional `S3Client`, swallow-and-log.
- Photo-id extraction from an S3 key: `processDeletedImage/index.ts:17` (`name.replace("-thumb","").replace(".webp","")`) vs `scripts/cleanup-s3.js:21-25` (strict leading-lowercase-UUID regex).
- Photo removal is done two ways, unranked: soft (`delete.ts:35-39`, `active = false`) and hard (`processDeletedImage/index.ts:141-144`, DELETE with dependent-table cleanup).

### Looked for and did not find (at 3813371)
- No code deletes `<id>-thumb.webp`: no presigned delete URL (`getSignedUrl` appears only at `controllers/photos/generateUploadUrl.ts:27` for a PutObjectCommand), no batch DeleteObjects, no Lambda invoke of processDeletedImage (grep `InvokeCommand` empty). Only `scripts/cleanup-s3.js` and manual S3 actions.
- No ownership/authorization check in `deletePhoto`: `delete.ts` never compares the photo's `createdBy` to `uuid`; only the frozen-wave role gate at `:30`.
- No existence check before the soft delete, no audit/abuse-report-driven deletion path, no EventBridge/cron rule for cleanup-s3, and no CDK lifecycle rule for the media bucket (`buckets.ts:36-39` commented out — "has to be done in the admin UI").
- Nothing deletes `<id>.webp` or video objects except `cleanup-s3.js`.
- File budget reached at 15 files (last read: `scripts/cleanup-s3.js`, `tests/seo-sidecar-lifecycle.js`). Not opened within budget: `lambda-fns/psql.ts` (connection/auth details behind `_cleanupTables`), `controllers/waves/_getWaveRole.ts` / `_isWaveFrozen.ts`, and the other four WavePhotos deleters.