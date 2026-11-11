#!/usr/bin/env node
/* eslint-env node */

// Backfill for ticket 8: read every video's real length out of its own container and publish it.
//
// Nothing had to be invented here, which is the point: production video objects carry no
// upload-time metadata (_bmad-output/seo-indexing/evidence/probe-duration-metadata.js), so the only
// trustworthy number is the one the camera wrote into moov/mvhd. The scheduled sitemap pass already
// learns a bounded slice of what is missing on every run, so this script is optional - it exists to
// finish the corpus faster than 150 videos per five hours, and to report what that costs in requests
// and bytes so the size of the job is measured rather than assumed.
//
//   node ./scripts/populate-video-durations.js prod --dry-run --limit=20
//   npm run populate-video-durations -- prod            # writes rows + records

// ts-node's hook is load-bearing: the controller imported below reaches "../../psql" without an
// extension, which plain @babel/register cannot resolve.
require('ts-node/register/transpile-only')

const fs = require('fs')
const path = require('path')
const Module = require('module')
const { S3Client } = require('@aws-sdk/client-s3')
const ServerlessClient = require('serverless-postgres')

const rdsCaPath = path.join(__dirname, '../lambda-fns/certs/global-bundle.pem')
const rdsCa = fs.readFileSync(rdsCaPath, 'utf8')

// lambda-fns/psql.ts imports that same certificate as a module; Node cannot parse .pem.
if (require.cache[rdsCaPath] === undefined) {
  const stub = new Module(rdsCaPath, null)
  stub.filename = rdsCaPath
  stub.loaded = true
  stub.exports = rdsCa
  require.cache[rdsCaPath] = stub
}

// The learner and the record writer are imported rather than reimplemented: a backfill that builds
// its own JSON would be a second copy of the contract, which is the bug class this ticket keeps
// removing.
const { probeVideoDuration, videoKeyForId, STORE_DURATION_SQL } = require('../lambda-fns/controllers/photos/_learnVideoDurations.ts')
const { PHOTO_SEO_QUERY } = require('../lambda-fns/controllers/photos/_updateSeoSidecar.ts')
const { putSeoSidecars } = require('../lambda-fns/utilities/seoSidecar.ts')

const args = process.argv.slice(2)
const envArg = args.find((arg) => !arg.startsWith('--'))
const env = envArg || process.env.NODE_ENV || 'dev'

let configModule
if (env === 'prod' || env === 'production') {
  configModule = require('../.env.prod')
} else if (env === 'test') {
  configModule = require('../.env.test')
} else {
  configModule = require('../.env.dev')
}
const config = configModule.config()

const BUCKET_NAME = config.S3_IMAGES_BUCKET || config.S3_BUCKET || `wisaw-img-${env}`
const DRY_RUN = args.includes('--dry-run')
const SKIP_SIDECARS = args.includes('--skip-sidecars')
const LIMIT = parseInt(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1]) || 500
const CONCURRENT_LIMIT = parseInt(args.find((arg) => arg.startsWith('--concurrent='))?.split('=')[1]) || 8

const s3 = new S3Client({ region: 'us-east-1' })

let dbPool = null
const getDbConnection = () => {
  if (!dbPool) {
    dbPool = new ServerlessClient({
      ...config,
      user: config.username,
      delayMs: 1000,
      maxConnections: 10,
      maxRetries: 2,
      ssl: { ca: rdsCa, rejectUnauthorized: true },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000
    })
  }
  return dbPool
}

// Ends the pool and forgets it: a ServerlessClient cannot be reused once ended, and both database
// phases go through getDbConnection().
async function closeDb () {
  if (dbPool == null) return
  const pool = dbPool
  dbPool = null
  await pool.end()
}

console.log('🔧 Starting video duration backfill')
console.log(`📊 Environment: ${env}`)
console.log(`🪣 S3 Bucket: ${BUCKET_NAME}`)
console.log(`🌊 Dry run: ${DRY_RUN ? 'YES' : 'NO'}`)
console.log(`🎯 Limit: ${LIMIT}`)
console.log(`⚡ Concurrent limit: ${CONCURRENT_LIMIT}`)

// Videos with no stored length. Newest first, so an interrupted run leaves the least-crawled end
// behind - the same ordering rule the sitemap backfill uses.
async function findVideoRows () {
  const db = getDbConnection()
  await db.connect()
  try {
    const missing = await db.query(`
      SELECT "id" FROM "Photos"
      WHERE "active" = true AND "video" = true AND "duration" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT $1
    `, [LIMIT])
    console.log(`📊 Videos without a duration: ${missing.rows.length}`)

    // Full SEO rows, not just ids: putSeoSidecars writes the whole record from what it is handed,
    // and a thin row would strip enrichment from an already-published page.
    const rows = []
    for (const { id } of missing.rows) {
      const full = await db.query(PHOTO_SEO_QUERY, [id])
      if (full.rows.length > 0) rows.push(full.rows[0])
    }
    return rows
  } finally {
    await closeDb()
  }
}

async function probeRows (rows) {
  const learned = []
  const stats = { bytes: 0, reads: 0 }
  const startedAt = Date.now()

  for (let i = 0; i < rows.length; i += CONCURRENT_LIMIT) {
    const chunk = rows.slice(i, i + CONCURRENT_LIMIT)
    const results = await Promise.allSettled(chunk.map(async (row) => {
      const key = await videoKeyForId(s3, BUCKET_NAME, row.id)
      return { row, seconds: await probeVideoDuration(s3, BUCKET_NAME, key, stats) }
    }))

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`⚠️ Probe failed for ${chunk[index].id}`)
        return
      }
      const { row, seconds } = result.value
      if (seconds == null) return
      row.duration = seconds
      learned.push(row)
    })
    console.log(`🔍 Probed ${Math.min(i + CONCURRENT_LIMIT, rows.length)}/${rows.length}, durations found: ${learned.length}`)
  }

  return { learned, stats, elapsedMs: Date.now() - startedAt }
}

async function storeRows (rows) {
  const db = getDbConnection()
  await db.connect()
  try {
    for (const row of rows) {
      await db.query(STORE_DURATION_SQL, [row.id, row.duration])
    }
    console.log(`💾 Stored durations on ${rows.length} rows (updatedAt untouched)`)
  } finally {
    await closeDb()
  }
}

async function main () {
  const startedAt = Date.now()
  const rows = await findVideoRows()
  if (rows.length === 0) {
    console.log('✅ Nothing to do: every active video already has a duration')
    return
  }

  const { learned, stats, elapsedMs } = await probeRows(rows)
  const perVideo = learned.length > 0 ? learned.length : rows.length
  console.log('📈 Probe cost', {
    attempted: rows.length,
    parsed: learned.length,
    bytesPerVideo: Math.round(stats.bytes / perVideo),
    requestsPerVideo: Number((stats.reads / perVideo).toFixed(2)),
    msPerVideo: Math.round(elapsedMs / perVideo)
  })

  if (learned.length === 0) {
    console.log('⚠️ No container yielded a duration; nothing written')
    return
  }

  if (DRY_RUN) {
    console.log(`🌊 Dry run: would store ${learned.length} durations and republish ${SKIP_SIDECARS ? 0 : learned.length} records`)
    learned.slice(0, 10).forEach((row) => console.log(`   ${row.id} → ${row.duration}s`))
    return
  }

  await storeRows(learned)

  if (!SKIP_SIDECARS) {
    const { written, failed } = await putSeoSidecars(s3, BUCKET_NAME, learned, CONCURRENT_LIMIT)
    console.log(`📝 Records republished: written=${written} failed=${failed}`)
  }

  console.log(`✅ Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
}

main().catch((err) => {
  console.error('❌ Video duration backfill failed', err)
  process.exitCode = 1
})
