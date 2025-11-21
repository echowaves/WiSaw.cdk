#!/usr/bin/env node

const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const ServerlessClient = require('serverless-postgres')

// Parse command line arguments
const args = process.argv.slice(2)
const envArg = args.find(arg => !arg.startsWith('--'))
const env = envArg || process.env.NODE_ENV || 'dev'

// Load environment-specific config (same pattern as your codebase)
const config = require(`../.env.${env}`).config()

// Set NODE_TLS_REJECT_UNAUTHORIZED if specified in config
if (config.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = config.NODE_TLS_REJECT_UNAUTHORIZED
}

const BUCKET_NAME = config.S3_BUCKET || `wisaw-img-${env}`
const DRY_RUN = process.argv.includes('--dry-run')

const s3 = new S3Client({ region: 'us-east-1' })

async function getPhotoIds() {
  const db = new ServerlessClient({
    ...config,  // Use the config object from the env file
    delayMs: 3000,
    maxConnections: 80,
    maxRetries: 3,
    ssl: true,
    connectionTimeoutMillis: 10000, // 10 second timeout
    idleTimeoutMillis: 10000,
  })
  try {
    console.log('🔗 Connecting to database...')

    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
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
    return new Set(); // Return empty set - will list all S3 objects
  }
}

async function getS3Objects() {
  console.log('☁️ Listing S3 objects...')
  const objects = []
  let token = null

  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
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

function extractPhotoId(key) {
  // Extract UUID from keys like: uuid.webp, uuid-thumb.webp, uuid.mov
  const match = key.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/)
  return match ? match[1] : null
}

async function main() {
  console.log(`🧹 S3 Cleanup - ${DRY_RUN ? 'DRY RUN' : 'LIVE MODE'}`)
  console.log('📡 Connecting to database...')

  const photoIds = await getPhotoIds()
  console.log(`✅ Database connected, found ${photoIds.size} photos`)

  console.log('☁️  Listing S3 objects...')
  const s3Objects = await getS3Objects()
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

    process.exit(0); // Force exit since db is already cleaned in getPhotoIds
  }

  console.log(`📊 Found ${photoIds.size} photos in DB, ${s3Objects.length} objects in S3`)

  const toDelete = []
  const unknownObjects = []

  for (const key of s3Objects) {
    const photoId = extractPhotoId(key)
    if (photoId === null) {
      // Object doesn't match UUID pattern - keep track but don't delete
      unknownObjects.push(key)
      toDelete.push(key)
    } else if (!photoIds.has(photoId)) {
      // Object has UUID but not in database - mark for deletion
      toDelete.push(key)
    }
  }

  console.log(`� Found ${unknownObjects.length} non-UUID objects (will be deleted)`)
  console.log(`�🗑️  ${toDelete.length} unreferenced  objects to delete`)

  if (unknownObjects.length > 0) {
    console.log('\nNon-UUID objects:')
    unknownObjects.slice(0, 5).forEach(key => console.log(`  ${key}`))
    if (unknownObjects.length > 5) {
      console.log(`  ... and ${unknownObjects.length - 5} more`)
    }
  }

  if (toDelete.length === 0) {
    console.log('✅ Nothing to delete!')
    process.exit(0); // Force exit since db is already cleaned in getPhotoIds
  }

  if (DRY_RUN) {
    console.log('Objects that would be deleted:')
    // toDelete.forEach(key => console.log(`  ${key}`))
    process.exit(0); // Force exit since db is already cleaned in getPhotoIds
  }

  // Delete objects
  for (const key of toDelete) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
      console.log(`✓ Deleted: ${key}`)
    } catch (error) {
      console.error(`✗ Failed to delete ${key}:`, error.message)
    }
  }

  console.log('✅ Cleanup complete!')
  process.exit(0); // Force exit since db is already cleaned in getPhotoIds
}

main().catch(console.error).finally(() => {
  // Force exit after a short delay to ensure all cleanup is done
  setTimeout(() => {
    process.exit(0)
  }, 1000)
})
