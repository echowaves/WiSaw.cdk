#!/usr/bin/env node
/* eslint-env node */

// One-off backfill of the SEO sidecar objects that injectMetaTagsLambdaFunction reads.
// generateSiteMap keeps them fresh going forward; this exists so the ~21k already-indexed
// URLs get their titles, descriptions and alt text at once instead of over weeks of crawls.
//
// The environment (dev | test | staging | prod) is required and picks the .env.<env> config.
// npm swallows extra args unless they come after "--":
//   npm run seo-sidecars -- prod --dry-run
// or call node directly:
//   node ./scripts/publish-seo-sidecars.js prod --dry-run
//   node ./scripts/publish-seo-sidecars.js prod --batch-size=500 --limit=5000
//   node ./scripts/publish-seo-sidecars.js prod --skip-duration-learning   # text now, lengths later
//
// The published objects are public (img.wisaw.com/<id>.json, at the bucket root beside the
// media itself). A place NAME belongs in one - it is what makes a photo findable - but a
// COORDINATE never does: the record builder composes the place name from the address columns and
// refuses anything that looks like a position.
//
// This writer reads the same row shape as every live writer and PUTs through their own function,
// so neither the record's contents nor its object metadata can drift from what an upload or the
// scheduled pass publishes. That is not decoration: this script used to list its columns by hand,
// it never learned about the "duration" column ticket 8 added, and every video record it published
// lost its duration - silently, because a PUT does not move "updatedAt", so the scheduled refresh
// had no reason to come back and put it right. tests/seo-crawler-contract.js pins both writers.

// ts-node's hook is load-bearing: the writer imported below is TypeScript, and plain
// @babel/register cannot resolve it from a script node runs directly (same as populate-video-durations.js).
require('ts-node/register/transpile-only')

const fs = require('fs')
const path = require('path')
const { S3Client } = require('@aws-sdk/client-s3')
const ServerlessClient = require('serverless-postgres')

const rdsCa = fs.readFileSync(path.join(__dirname, '../lambda-fns/certs/global-bundle.pem'), 'utf8')

function fail (message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const envArg = args.find((arg) => !arg.startsWith('--'))
const envAliases = { production: 'prod', development: 'dev' }
const env = envAliases[envArg || process.env.NODE_ENV || ''] || envArg || process.env.NODE_ENV

function loadEnvConfig (envName) {
  if (!envName) {
    fail('no environment given. Pass one of: dev, test, staging, prod.\n' +
      '   e.g. npm run seo-sidecars -- prod --dry-run')
  }
  if (!['dev', 'test', 'staging', 'prod'].includes(envName)) {
    fail(`unknown environment "${envName}". Pass one of: dev, test, staging, prod.`)
  }

  const configFile = `.env.${envName}`
  try {
    return require(`../${configFile}`)
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err
    fail(`${configFile} is missing (env files are gitignored). Copy .env.sample to ${configFile} and fill in the credentials, or pick an environment you already have configured.`)
  }
}

// Resolved lazily so the module can be required (by tests) without an environment configured.
let resolvedConfig = null
function getConfig () {
  if (resolvedConfig != null) return resolvedConfig
  const configModule = loadEnvConfig(env)
  resolvedConfig = typeof configModule.config === 'function' ? configModule.config() : configModule
  return resolvedConfig
}

// The media bucket comes from the same resolver every live writer uses, read AFTER the env file
// has been loaded - that file is what defines S3_BUCKET. This script used to derive its own name
// from the environment argument (`wisaw-img-<env>`), which is how a backfill could publish beside
// one corpus while the edge and the scheduled job read another. S3_IMAGES in the env files is the
// CDN hostname, not a bucket, so it is deliberately not consulted here either.
function getBucket () {
  getConfig()
  return seoSidecarBucket()
}
const DRY_RUN = args.includes('--dry-run')
const BATCH_SIZE = parseInt((args.find((a) => a.startsWith('--batch-size=')) || '').split('=')[1] || '200', 10)
const LIMIT = parseInt((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || '0', 10)
const CONCURRENT_LIMIT = parseInt((args.find((a) => a.startsWith('--concurrency=')) || '').split('=')[1] || '16', 10)

// Every text rule and the record shape itself come from the one module the edge loads and the
// scheduled job uses (lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoRules.js), so a backfilled
// record cannot differ from a scheduled one. The PUT comes from the live writers' own helper, so the
// key, content type and cache control are theirs too. tests/seo-crawler-contract.js pins all of it.
const { buildSeoRecord } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoRules')
const { putSeoSidecar, seoSidecarBucket, sidecarKey } = require('../lambda-fns/utilities/seoSidecar.ts')
const { seoRowQuery } = require('../lambda-fns/utilities/seoPhotoRow.ts')

// Loaded lazily on purpose. The duration learner writes through its own Postgres client, and that
// client builds its connection from process.env when the module is first imported - so it must not
// be imported before getConfig() has loaded .env.<env>, or a prod backfill would measure rows in
// whichever database happened to be configured in the shell. Same reason populate-video-durations.js
// notes ts-node here.
function loadDurationLearner () {
  return require('../lambda-fns/controllers/photos/_learnVideoDurations.ts').learnVideoDurations
}

// Exported for the contract test, which builds a record from both writers and compares them.
const buildSidecar = (row) => buildSeoRecord(row)

function getDbConnection () {
  const cfg = getConfig()
  return new ServerlessClient({
    ...cfg,
    user: cfg.username,
    delayMs: 1000,
    maxConnections: 20,
    maxRetries: 2,
    ssl: { ca: rdsCa, rejectUnauthorized: true },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
  })
}

// One row shape for every writer of a sidecar, built by the shared projection in
// lambda-fns/utilities/seoPhotoRow.ts; this caller only says which rows it wants. Listing columns
// by hand is how "duration" went missing here for months, and copying the statement - as this file
// and the sitemap job each used to - is how one copy drifted from the other.
const QUERY = seoRowQuery({
  where: 'p."active" = true',
  orderBy: 'p."createdAt" DESC',
  limit: LIMIT
})

// One chunk's writes, exported so a test can drive the real PUT with a stubbed client and see which
// bucket and which row the script actually hands over. A dry run prints what it would write; the
// duration is named on its own because a long caption pushes it past the 200-character preview.
async function publishChunk (client, bucket, rows, dryRun) {
  const results = await Promise.allSettled(rows.map(async (row) => {
    if (dryRun) {
      const sidecar = buildSidecar(row)
      console.log(sidecarKey(row.id), `duration=${sidecar.duration ?? 'none'}`, JSON.stringify(sidecar).slice(0, 200))
      return
    }
    // The live writers' PUT: key, body and headers all come from one place.
    await putSeoSidecar(client, bucket, row)
  }))

  let written = 0
  let failed = 0
  results.forEach((r) => (r.status === 'fulfilled' ? written++ : failed++))
  return { written, failed }
}

// A dry run must not report writes it never made: the number means "objects this run would put"
// until something has actually been PUT. Exported so the wording is pinned rather than eyeballed.
// Probing a video container costs a LIST, a HEAD and up to two ranged GETs, so an operator who
// wants the text published now and the durations later should not have to wait for - or pay for -
// the measurement pass. Mirrors populate-video-durations.js's own --skip-sidecars escape hatch.
function shouldLearnDurations (argv, dryRun) {
  return !dryRun && !argv.includes('--skip-duration-learning')
}

function writeLabel (dryRun) {
  return dryRun ? 'wouldWrite' : 'written'
}

async function main () {
  const bucket = getBucket()
  const label = writeLabel(DRY_RUN)

  console.log('🔧 Publishing SEO sidecars')
  console.log(`📊 Environment: ${env}`)
  console.log(`🪣 Bucket: ${bucket}`)
  console.log(`🌊 Dry run: ${DRY_RUN ? 'YES' : 'NO'}`)
  console.log(`📦 Batch size: ${BATCH_SIZE} | concurrency: ${CONCURRENT_LIMIT} | limit: ${LIMIT || 'none'}`)

  const db = getDbConnection()
  await db.connect()
  const { rows } = await db.query(QUERY)
  await db.clean()
  console.log(`📊 Photos to publish: ${rows.length}`)

  const s3 = new S3Client({ region: 'us-east-1' })

  // Videos whose length nobody has read yet get measured here, through the live writers' own
  // learner: it probes the stored container and persists the number, so a backfill that runs before
  // the scheduled pass gets there is not publishing video records with no duration. Best-effort -
  // losing it leaves those rows as "duration unknown", which every reader renders as no duration.
  // Skipped in a dry run because persisting is a write like any other.
  if (!shouldLearnDurations(args, DRY_RUN)) {
    console.log(DRY_RUN
      ? '🌊 Dry run: skipping duration learning, which writes to Postgres'
      : '⏭ Skipping duration learning (--skip-duration-learning)')
  } else {
    try {
      const learned = await loadDurationLearner()(rows, { bucket, client: s3, limit: rows.length, concurrency: CONCURRENT_LIMIT })
      console.log(`⏱ durations: checked=${learned.checked} learned=${learned.learned.length} failed=${learned.failed}`)
    } catch (err) {
      console.error('duration learning unavailable; publishing the durations the rows already state', { err })
    }
  }

  let written = 0
  let failed = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    for (let j = 0; j < batch.length; j += CONCURRENT_LIMIT) {
      const chunk = await publishChunk(s3, bucket, batch.slice(j, j + CONCURRENT_LIMIT), DRY_RUN)
      written += chunk.written
      failed += chunk.failed
    }
    console.log(`… ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} (${label}=${written} failed=${failed})`)
  }

  console.log(`✅ Done. ${label}=${written} failed=${failed}${DRY_RUN ? ' (dry run)' : ''}`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Failed:', err)
    process.exitCode = 1
  })
}

// Exported for tests: the contract test pins the published body and the query's columns, the
// lifecycle test drives publishChunk with a stubbed client to see the PUT the script really makes.
module.exports = { buildSidecar, QUERY, publishChunk, shouldLearnDurations, writeLabel }
