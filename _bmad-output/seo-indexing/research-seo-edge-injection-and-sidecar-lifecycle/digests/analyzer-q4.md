## Digest — Q4: how `scripts/cleanup-s3.js` classifies and deletes S3 keys @ 3813371

### Classification

- **Load-bearing.** The whole reconciliation is one pure function, `classifyKey(key, activeIds) => 'keep' | 'delete' | 'report'`, documented by a rule-table comment: media `uuid.*`/`uuid-thumb.webp` whose DB row is gone → delete; `seo/<uuid>.json` sidecar whose row is gone → delete; sidecar of an active photo → keep; anything else (incl. `seo/_last-run.json`, junk) → report only, never delete — the comment records that "the old code deleted every non-UUID key, which took out all ~22k sidecars and the watermark" (`scripts/cleanup-s3.js:27-33` classifyKey @ 3813371).
- **Load-bearing.** Implementation order: first test `SIDECAR_KEY_RE = /^seo\/([a-f0-9]{8}-…-[a-f0-9]{12}\.json)$/` (lowercase-UUID sidecar, `.json` stripped from the capture); a match returns `'keep'` if the UUID is in `activeIds`, else `'delete'`; otherwise `extractPhotoId` extracts a lowercase-UUID **prefix** (`^uuid` — no delimiter or extension required) and returns `'keep'`/`'delete'` on membership; a key with neither shape returns `'report'` (`scripts/cleanup-s3.js:19` SIDECAR_KEY_RE, `:21-25` extractPhotoId, `:33-44` classifyKey @ 3813371). Consequence visible in code: uppercase-UUID keys never match either regex and are always `'report'`.
- The sidecar-key contract is the writer's: `sidecarKey(id)` returns `seo/<lowercase-id>.json` — cleanup-s3's comment at `:15-:16` names it; non-UUID ids written through it produce keys that miss `SIDECAR_KEY_RE` and land in `'report'` (`lambda-fns/utilities/seoSidecar.ts:115-117` sidecarKey @ 3813371).
- The "active set" is built from `SELECT "id" FROM "Photos" WHERE "active" = true`, collected into a `Set` of row ids (`scripts/cleanup-s3.js:80` getPhotoIds, `:83` @ 3813371).
- The driver loops all listed keys through the classifier: `'delete'` → `toDelete`, `'report'` → `reported` (surfaced in logs, first 5 printed, never deleted); `'keep'` falls through (`scripts/cleanup-s3.js:150-173` main @ 3813371).
- All keys come from full-bucket `ListObjectsV2` pagination via `ContinuationToken`/`NextContinuationToken`, collecting only `obj.Key` (`scripts/cleanup-s3.js:94-113` getS3Objects @ 3813371).

### Deletion

- **Load-bearing.** Deletion is a sequential `for…of` loop, one `DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key })` per key with `await` — no batch `DeleteObjects`, no concurrency (`scripts/cleanup-s3.js:187-194` main @ 3813371).
- Dry-run never deletes: `DRY_RUN = process.argv.includes('--dry-run')`; if set and `toDelete` is non-empty, it prints a header and exits before the delete loop — and the per-key print is commented out, so dry-run shows only counts (`scripts/cleanup-s3.js:120`, `:180-184` main @ 3813371). npm entry points: `cleanup-s3` and `cleanup-s3:dry-run` (`package.json:19-20` scripts @ 3813371).
- Bucket is `config.S3_BUCKET || wisaw-img-${env}`; S3 client region hardcoded `us-east-1` (`scripts/cleanup-s3.js:119-121` main @ 3813371).

### Checks that reject a value or throw (on the classify→delete path)

- `getPhotoIds` wraps connect+query in a 15 s `Promise.race` timeout that rejects with "Database connection timeout" (`scripts/cleanup-s3.js:73-76`, `:86` @ 3813371); the catch does **not** rethrow — it degrades to an empty `Set` and announces LIST-ONLY mode (`:87-91` @ 3813371).
- **Load-bearing.** Empty active set (DB failure *or* genuinely zero active photos — indistinguishable) short-circuits at `photoIds.size === 0`: log the object count, optionally print 10 keys if dry-run, `process.exit(0)` before any classification or deletion (`scripts/cleanup-s3.js:133-146` main @ 3813371).
- `extractPhotoId` returns `null` (not throw) on non-match; `classifyKey` maps that to `'report'` — the reject-instead-of-delete guard (`scripts/cleanup-s3.js:24`, `:40-42` @ 3813371).
- Per-key delete failures are caught, logged ("✗ Failed to delete"), and skipped; the loop continues and the run still ends "Cleanup complete" (`scripts/cleanup-s3.js:191-193` main @ 3813371).
- Unknown `env` is not rejected: `ENV_CONFIG_LOADERS[env] || ENV_CONFIG_LOADERS.dev` falls back to dev config (`scripts/cleanup-s3.js:48-49`, `:52-:56`, `:116` @ 3813371). A missing `.env.<env>` module or config() throw lands in `main().catch(console.error)`, and the `finally` still `process.exit(0)` — exit code is 0 even on failure (`scripts/cleanup-s3.js:200-207` @ 3813371).
- Header claims "require()-able without side effects"; true for env config, S3 client, and DB (all inside `main`), but the RDS CA cert is `fs.readFileSync`'d at module load (`scripts/cleanup-s3.js:4-6`, `:13` @ 3813371).

### Structure (indented)

- `main` `scripts/cleanup-s3.js:115` → `getPhotoIds` `:58` (pg query `:80`) → `getS3Objects` `:94` → LIST-ONLY guard `:133` → classify loop `:153` (`classifyKey` `:33`) → dry-run exit `:180` → delete loop `:187`
- Exports for reuse: `module.exports = { classifyKey, extractPhotoId }` `scripts/cleanup-s3.js:209`; sole consumer is the test import at `tests/seo-sidecar-lifecycle.js:33` (describe block `:149`).

### Looked for, did not find

- No use of the S3 batch `DeleteObjectsCommand` anywhere in the script (`git grep DeleteObjects 3813371 -- scripts` — only `DeleteObjectCommand` at :10/:189).
- No prefix scoping (`Prefix:` param) on the list, no exclusion list/watermark key allowlist beyond what the classifier's `'report'` branch provides; searched cleanup-s3.js for `Prefix`, `watermark` @ 3813371.
- No test asserting the LIST-ONLY/empty-set behavior found by name in the grep of tests importing the module (only the two hits at `tests/seo-sidecar-lifecycle.js:33`/`:149`); I did not open that test file's bodies (budget focus).
- Files read: 4 of 15 budget (`scripts/cleanup-s3.js`, `package.json`, `lambda-fns/utilities/seoSidecar.ts`, plus grep-only hit in `tests/seo-sidecar-lifecycle.js`).
