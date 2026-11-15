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

// S3_IMAGES in the env files is the CDN hostname, not a bucket - the media bucket is
// always wisaw-img-<env>.
const BUCKET_NAME = process.env.S3_IMAGES_BUCKET || `wisaw-img-${env}`
const DRY_RUN = args.includes('--dry-run')
const BATCH_SIZE = parseInt((args.find((a) => a.startsWith('--batch-size=')) || '').split('=')[1] || '200', 10)
const LIMIT = parseInt((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || '0', 10)
const CONCURRENT_LIMIT = parseInt((args.find((a) => a.startsWith('--concurrency=')) || '').split('=')[1] || '16', 10)

// Every text rule and the record shape itself come from the one module the edge loads and the
// scheduled job uses (lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoRules.js), so a backfilled
// record cannot differ from a scheduled one. The PUT comes from the live writers' own helper, so the
// key, content type and cache control are theirs too. tests/seo-crawler-contract.js pins all of it.
const { buildSeoRecord } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoRules')
const { putSeoSidecar, sidecarKey } = require('../lambda-fns/utilities/seoSidecar.ts')

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

// One row shape for every writer of a sidecar: the full row plus aggregated labels, exactly what
// PHOTO_SEO_QUERY (lambda-fns/controllers/photos/_updateSeoSidecar.ts) and the sitemap job read.
// Listing columns by hand is how "duration" went missing here for months. p."location" - the
// geography column - arrives with p.* and is never read by anyone: a record's place name is composed
// from locality/district/region alone, and assertNoPreciseLocation screens what does get composed, so
// a value that reads like a position stops that write instead of being published.
const QUERY = `
  SELECT
    p.*,
    COALESCE(r."labels", '[]'::jsonb) AS "labels"
  FROM "Photos" p
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(l ->> 'Name') AS "labels"
    FROM "Recognitions" rec,
         -- Same scalar guard as generateSiteMap: one non-array Labels value aborts the
         -- whole statement (22023) and would fail the run for all ~21k photos.
         jsonb_array_elements(
           CASE WHEN jsonb_typeof(rec."metaData" -> 'Labels') = 'array'
                THEN rec."metaData" -> 'Labels'
                ELSE '[]'::jsonb END
         ) l
    WHERE rec."photoId" = p."id"
      AND coalesce(l ->> 'Name', '') <> ''
  ) r ON true
  WHERE p."active" = true
  ORDER BY p."createdAt" DESC
  ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}
`

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

async function main () {
  console.log('🔧 Publishing SEO sidecars')
  console.log(`📊 Environment: ${env}`)
  console.log(`🪣 Bucket: ${BUCKET_NAME}`)
  console.log(`🌊 Dry run: ${DRY_RUN ? 'YES' : 'NO'}`)
  console.log(`📦 Batch size: ${BATCH_SIZE} | concurrency: ${CONCURRENT_LIMIT} | limit: ${LIMIT || 'none'}`)

  const db = getDbConnection()
  await db.connect()
  const { rows } = await db.query(QUERY)
  await db.clean()
  console.log(`📊 Photos to publish: ${rows.length}`)

  const s3 = new S3Client({ region: 'us-east-1' })
  let written = 0
  let failed = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    for (let j = 0; j < batch.length; j += CONCURRENT_LIMIT) {
      const chunk = await publishChunk(s3, BUCKET_NAME, batch.slice(j, j + CONCURRENT_LIMIT), DRY_RUN)
      written += chunk.written
      failed += chunk.failed
    }
    console.log(`… ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} (written=${written} failed=${failed})`)
  }

  console.log(`✅ Done. written=${written} failed=${failed}${DRY_RUN ? ' (dry run)' : ''}`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Failed:', err)
    process.exitCode = 1
  })
}

// Exported for tests: the contract test pins the published body and the query's columns, the
// lifecycle test drives publishChunk with a stubbed client to see the PUT the script really makes.
module.exports = { buildSidecar, QUERY, publishChunk }
