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

const configModule = loadEnvConfig(env)
const config = typeof configModule.config === 'function' ? configModule.config() : configModule

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

function locationText (row) {
  return [row.locality, row.district, row.region]
    .map(clean)
    .filter(Boolean)
    .filter((part, i, all) => all.indexOf(part) === i)
    .join(', ')
}

function getDbConnection () {
  return new ServerlessClient({
    ...config,
    user: config.username,
    delayMs: 1000,
    maxConnections: 20,
    maxRetries: 2,
    ssl: { ca: rdsCa, rejectUnauthorized: true },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
  })
}

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
         jsonb_array_elements(rec."metaData" -> 'Labels') l
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
        const sidecar = {
          v: 1,
          caption: clean(row.lastComment).slice(0, 200),
          labels: pickLabels(row.labels),
          created: row.createdAt ? new Date(row.createdAt).toISOString() : '',
          location: locationText(row),
          width: clean(row.width),
          height: clean(row.height)
        }
        if (DRY_RUN) {
          console.log(`seo/${row.id}.json`, JSON.stringify(sidecar).slice(0, 200))
          return
        }
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: `seo/${row.id}.json`,
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

main().catch((err) => {
  console.error('❌ Failed:', err)
  process.exitCode = 1
})
