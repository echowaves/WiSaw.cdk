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
// media itself). A place NAME belongs in one -
// it is what makes a photo findable - but a COORDINATE never does, so the query selects the
// address columns and not the "location" geography column, and buildSidecar rejects anything
// that looks like a position anyway. It mirrors buildSeoSidecar in
// lambda-fns/utilities/seoSidecar.ts: the two shapes must stay identical, and
// tests/seo-crawler-contract.js pins both.

const fs = require('fs')
const path = require('path')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
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

const clean = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim()

function pickLabels (rawLabels, limit = 8) {
  const seen = new Set()
  const out = []
  for (const label of Array.isArray(rawLabels) ? rawLabels : []) {
    const name = clean(label)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
    if (out.length >= limit) break
  }
  return out
}

// Mirrors locationText()/isPreciseLocation() in lambda-fns/utilities/seoSidecar.ts; the test
// suite pins that both writers publish the same keys and reject the same values.
function locationText (row) {
  return [row.locality, row.district, row.region]
    .map(clean)
    .filter(Boolean)
    .filter((part, i, all) => all.indexOf(part) === i)
    .join(', ')
}

const PRECISE_KEYS = ['lat', 'lon', 'lng', 'latitude', 'longitude', 'coords', 'coordinates', 'gps', 'geopoint', 'point']

function isPreciseLocation (value) {
  if (value == null) return false
  if (typeof value === 'object') return true
  const text = String(value).trim()
  if (text === '') return false
  if (/POINT\s*\(/i.test(text)) return true
  if (/^0[01][0-9A-Fa-f]{16,}$/.test(text)) return true // WKB/EWKB hex from the geography column
  return /^-?\d{1,3}\.\d+\s*[,\s]\s*-?\d{1,3}\.\d+$/.test(text)
}

function buildSidecar (row) {
  const sidecar = {
    // Keep in step with SEO_SIDECAR_VERSION in lambda-fns/utilities/seoSidecar.ts.
    v: 1,
    caption: clean(row.lastComment).slice(0, 200),
    labels: pickLabels(row.labels),
    created: row.createdAt ? new Date(row.createdAt).toISOString() : '',
    location: locationText(row),
    width: clean(row.width),
    height: clean(row.height)
  }
  const leaked = Object.keys(sidecar).filter((key) => PRECISE_KEYS.includes(key.toLowerCase()))
  if (leaked.length > 0) {
    throw new Error(`refusing to publish a sidecar with a coordinate field: ${leaked.join(', ')}`)
  }
  if (isPreciseLocation(sidecar.location)) {
    throw new Error('refusing to publish a sidecar whose location is a coordinate, not a place name')
  }
  return sidecar
}

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

// The address columns are here for the place name; p."location" (the geography column, i.e.
// the actual coordinates) deliberately is not - see buildSidecar.
const QUERY = `
  SELECT
    p."id",
    p."video",
    p."lastComment",
    p."createdAt",
    p."width",
    p."height",
    p."locality",
    p."district",
    p."region",
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
      const chunk = batch.slice(j, j + CONCURRENT_LIMIT)
      const results = await Promise.allSettled(chunk.map(async (row) => {
        const sidecar = buildSidecar(row)
        if (DRY_RUN) {
          console.log(`${row.id}.json`, JSON.stringify(sidecar).slice(0, 200))
          return
        }
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `${String(row.id).toLowerCase()}.json`,
          Body: JSON.stringify(sidecar),
          ContentType: 'application/json',
          CacheControl: 'max-age=60'
        }))
      }))
      results.forEach((r) => (r.status === 'fulfilled' ? written++ : failed++))
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

// Exported for tests/seo-crawler-contract.js, which pins the published body shape.
module.exports = { buildSidecar, pickLabels, QUERY }
