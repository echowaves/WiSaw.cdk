#!/usr/bin/env node
/* eslint-env node */

// Reconciles the media bucket against Postgres. This module is require()-able without
// side effects (tests/seo-sidecar-lifecycle.js imports its classifier), so env config,
// the S3 client, and the DB connection all happen inside main() — never at load time.

const fs = require('fs')
const path = require('path')
const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const ServerlessClient = require('serverless-postgres')

const rdsCa = fs.readFileSync(path.join(__dirname, '../lambda-fns/certs/global-bundle.pem'), 'utf8')

// A sidecar key is exactly seo/<lowercase-uuid>.json — the contract of sidecarKey() in
// lambda-fns/utilities/seoSidecar.ts, with the same strict UUID shape as extractPhotoId().
// Anything else under seo/ (e.g. _last-run.json or a malformed id) is not a photo sidecar
// and must never be deleted here.
const SIDECAR_KEY_RE = /^seo\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json)$/

function extractPhotoId (key) {
  // Extract UUID from keys like: uuid.webp, uuid-thumb.webp, uuid.mov
  const match = key.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/)
  return match ? match[1] : null
}

// Pure classifier for the reconciliation pass: (key, activeIds) => 'keep' | 'delete' | 'report'.
//   uuid.* / uuid-thumb.webp media whose row is gone          → delete (existing photo rule)
//   seo/<uuid>.json sidecar whose row is gone                 → delete (prune orphans)
//   seo/<uuid>.json sidecar of an active photo                → keep
//   anything else, incl. seo/_last-run.json and junk keys     → report only, NEVER delete.
// The old code deleted every non-UUID key, which took out all ~22k sidecars and the watermark.
function classifyKey (key, activeIds) {
  const sidecarId = key.match(SIDECAR_KEY_RE)?.[1]?.replace(/\.json$/, '') ?? null
  if (sidecarId !== null) {
    return activeIds.has(sidecarId) ? 'keep' : 'delete'
  }

  const photoId = extractPhotoId(key)
  if (photoId === null) {
    return 'report'
  }
  return activeIds.has(photoId) ? 'keep' : 'delete'
}

// Parse command line arguments
const args = process.argv.slice(2)
const envArg = args.find(arg => !arg.startsWith('--'))
const env = envArg || process.env.NODE_ENV || 'dev'

// Load environment-specific config (same pattern as your codebase)
const ENV_CONFIG_LOADERS = {
  dev: () => require('../.env.dev'),
  staging: () => require('../.env.staging'),
  prod: () => require('../.env.prod')
}

async function getPhotoIds (config) {
  const db = new ServerlessClient({
    ...config, // Use the config object from the env file
    user: config.username, // pg.Client expects 'user', not 'username'
    delayMs: 3000,
    maxConnections: 80,
    maxRetries: 3,
    ssl: { ca: rdsCa, rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, // 10 second timeout
    idleTimeoutMillis: 10000
  })
  try {
    console.log('🔗 Connecting to database...')

    // Add timeout wrapper
    const timeoutPromise = new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 15000)
    })

    const connectPromise = (async () => {
      await db.connect()
      console.log('📊 Running query to get photo IDs...')
      const result = await db.query('SELECT "id" FROM "Photos" WHERE "active" = true')
      console.log(`📊 Found ${result.rows.length} active photos`)
      await db.clean()
      return new Set(result.rows.map(row => row.id))
    })()

    return await Promise.race([connectPromise, timeoutPromise])
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    console.log('⚠️  Continuing without database verification (LIST-ONLY mode)')
    return new Set() // Return empty set - will list all S3 objects
  }
}

async function getS3Objects (s3, bucketName) {
  console.log('☁️ Listing S3 objects...')
  const objects = []
  let token

  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: token
    }))

    if (response.Contents) {
      objects.push(...response.Contents.map(obj => obj.Key))
      console.log(`📦 Retrieved ${objects.length} objects so far...`)
    }
    token = response.NextContinuationToken
  } while (token)

  return objects
}

async function main () {
  const loadConfigModule = ENV_CONFIG_LOADERS[env] || ENV_CONFIG_LOADERS.dev
  const config = loadConfigModule().config()

  const BUCKET_NAME = config.S3_BUCKET || `wisaw-img-${env}`
  const DRY_RUN = process.argv.includes('--dry-run')
  const s3 = new S3Client({ region: 'us-east-1' })

  console.log(`🧹 S3 Cleanup - ${DRY_RUN ? 'DRY RUN' : 'LIVE MODE'}`)
  console.log('📡 Connecting to database...')

  const photoIds = await getPhotoIds(config)
  console.log(`✅ Database connected, found ${photoIds.size} photos`)

  console.log('☁️  Listing S3 objects...')
  const s3Objects = await getS3Objects(s3, BUCKET_NAME)
  console.log(`✅ S3 connected, found ${s3Objects.length} objects`)

  if (photoIds.size === 0) {
    console.log('⚠️  No database data available - showing all S3 objects (LIST-ONLY mode)')
    console.log(`📦 S3 objects found: ${s3Objects.length}`)

    if (DRY_RUN) {
      console.log('\nS3 objects (first 10):')
      s3Objects.slice(0, 10).forEach(key => console.log(`  ${key}`))
      if (s3Objects.length > 10) {
        console.log(`  ... and ${s3Objects.length - 10} more`)
      }
    }

    process.exit(0) // Force exit since db is already cleaned in getPhotoIds
  }

  console.log(`📊 Found ${photoIds.size} photos in DB, ${s3Objects.length} objects in S3`)

  const toDelete = []
  const reported = []

  for (const key of s3Objects) {
    const verdict = classifyKey(key, photoIds)
    if (verdict === 'delete') {
      // Media or orphaned sidecar whose active row is gone - mark for deletion
      toDelete.push(key)
    } else if (verdict === 'report') {
      // Key we don't understand (seo/_last-run.json, other non-UUID junk): surface it, never delete it.
      reported.push(key)
    }
  }

  console.log(`🔎 Found ${reported.length} unrecognized objects (reported only, will NOT be deleted)`)
  console.log(`🗑️  ${toDelete.length} unreferenced  objects to delete`)

  if (reported.length > 0) {
    console.log('\nUnrecognized objects (kept):')
    reported.slice(0, 5).forEach(key => console.log(`  ${key}`))
    if (reported.length > 5) {
      console.log(`  ... and ${reported.length - 5} more`)
    }
  }

  if (toDelete.length === 0) {
    console.log('✅ Nothing to delete!')
    process.exit(0) // Force exit since db is already cleaned in getPhotoIds
  }

  if (DRY_RUN) {
    console.log('Objects that would be deleted:')
    // toDelete.forEach(key => console.log(`  ${key}`))
    process.exit(0) // Force exit since db is already cleaned in getPhotoIds
  }

  // Delete objects
  for (const key of toDelete) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
      console.log(`✓ Deleted: ${key}`)
    } catch (error) {
      console.error('✗ Failed to delete:', key, error.message)
    }
  }

  console.log('✅ Cleanup complete!')
  process.exit(0) // Force exit since db is already cleaned in getPhotoIds
}

if (require.main === module) {
  main().catch(console.error).finally(() => {
    // Force exit after a short delay to ensure all cleanup is done
    setTimeout(() => {
      process.exit(0)
    }, 1000)
  })
}

module.exports = { classifyKey, extractPhotoId }
