#!/usr/bin/env node
/* eslint-env node */

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const { RekognitionClient, DetectLabelsCommand, DetectModerationLabelsCommand, DetectTextCommand } = require('@aws-sdk/client-rekognition')
const ServerlessClient = require('serverless-postgres')
const sharp = require('sharp')
const moment = require('moment')

// Parse command line arguments
const args = process.argv.slice(2)
const envArg = args.find(arg => !arg.startsWith('--'))
const env = envArg || process.env.NODE_ENV || 'dev'

function loadEnvConfig(envName) {
  switch (envName) {
    case 'prod':
    case 'production':
      return require('../.env.prod')
    case 'staging':
      return require('../.env.staging')
    case 'test':
      return require('../.env.test')
    case 'dev':
    case 'development':
      return require('../.env.dev')
    default:
      console.warn(`⚠️  Unknown environment "${envName}", falling back to dev config`)
      return require('../.env.dev')
  }
}

// Load environment-specific config
const configModule = loadEnvConfig(env)
const config = typeof configModule.config === 'function'
  ? configModule.config()
  : configModule

// Set NODE_TLS_REJECT_UNAUTHORIZED if specified in config
if (config.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = config.NODE_TLS_REJECT_UNAUTHORIZED
}

const BUCKET_NAME = config.S3_BUCKET || `wisaw-img-${env}`
const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 10
const CONCURRENT_LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--concurrent='))?.split('=')[1]) || 5

const s3 = new S3Client({ region: 'us-east-1' })
const rekognition = new RekognitionClient({ region: 'us-east-1' })

// Create a shared database connection pool
let dbPool = null
const getDbConnection = () => {
  if (!dbPool) {
    dbPool = new ServerlessClient({
      ...config,
      delayMs: 1000,
      maxConnections: 20,
      maxRetries: 2,
      ssl: true,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    })
  }
  return dbPool
}

console.log(`🔧 Starting photo recognition population script`)
console.log(`📊 Environment: ${env}`)
console.log(`🪣 S3 Bucket: ${BUCKET_NAME}`)
console.log(`🌊 Dry run: ${DRY_RUN ? 'YES' : 'NO'}`)
console.log(`📦 Batch size: ${BATCH_SIZE}`)
console.log(`⚡ Concurrent limit: ${CONCURRENT_LIMIT}`)

async function getPhotosWithoutRecognitions() {
  const db = getDbConnection()

  try {
    console.log('🔗 Connecting to database...')

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 10000)
    })

    const connectPromise = (async () => {
      await db.connect()
      console.log('📊 Running query to get photos with empty Labels in recognitions...')
      const result = await db.query(`
        SELECT p."id", p."createdAt"
        FROM "Photos" p
        INNER JOIN "Recognitions" r ON p."id" = r."photoId"
        WHERE p."active" = true 
        AND (
          r."metaData"->'Labels' IS NULL
          OR r."metaData"->'Labels' = '[]'::jsonb
          OR (jsonb_typeof(r."metaData"->'Labels') = 'array' AND jsonb_array_length(r."metaData"->'Labels') = 0)
        )
        ORDER BY p."createdAt" DESC        
      `)
      console.log(`📊 Found ${result.rows.length} photos with empty recognitions`)
      return result.rows
    })()

    return await Promise.race([connectPromise, timeoutPromise])
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    throw error
  }
}

async function generateImageRecognitions(photoId) {
  try {
    let imageKey = `${photoId}.webp`
    let imageData

    try {
      const getObjectCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: imageKey })
      const response = await s3.send(getObjectCommand)
      imageData = await response.Body.transformToByteArray()
    } catch (webpError) {
      console.log(`⚠️  .webp not found for ${photoId}, trying .upload version`)
      imageKey = `${photoId}.upload`
      try {
        const getObjectCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: imageKey })
        const response = await s3.send(getObjectCommand)
        imageData = await response.Body.transformToByteArray()
      } catch (uploadError) {
        console.error(`❌ Could not find image for ${photoId} (tried .webp and .upload)`)
        return null
      }
    }

    if (!imageData) {
      console.error(`❌ No image data retrieved for ${photoId}`)
      return null
    }

    // Convert to PNG format and resize to stay under 5MB limit
    let pngBuffer = await sharp(imageData)
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer()

    // If still too large, reduce size further
    if (pngBuffer.length > 5242880) { // 5MB in bytes
      console.log(`⚠️  Image ${photoId} is ${Math.round(pngBuffer.length / 1024 / 1024 * 100) / 100}MB, resizing further...`)
      pngBuffer = await sharp(imageData)
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer()

      // If STILL too large, try JPEG with lower quality
      if (pngBuffer.length > 5242880) {
        console.log(`⚠️  Image ${photoId} still too large, converting to JPEG...`)
        pngBuffer = await sharp(imageData)
          .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer()
      }
    }

    const params = { Image: { Bytes: pngBuffer } }

    const metaData = {
      Labels: [],
      TextDetections: [],
      ModerationLabels: [],
    }

    const [labelsData, moderationData, textData] = await Promise.all([
        rekognition.send(new DetectLabelsCommand(params)),
        rekognition.send(new DetectModerationLabelsCommand(params)),
        rekognition.send(new DetectTextCommand(params)),
    ])

    metaData.Labels = labelsData?.Labels || []
    metaData.ModerationLabels = moderationData?.ModerationLabels || []
    metaData.TextDetections = textData?.TextDetections || []

    console.log(`👁️  Generated recognitions for ${photoId}`)
    return metaData
  } catch (error) {
    console.error(`❌ Error processing ${photoId}:`, error.message)
    return null
  }
}

async function saveRecognitions(photoId, metaData) {
  if (DRY_RUN) {
    console.log(`🔍 DRY RUN: Would update recognitions for ${photoId}`)
    return true
  }

  const db = getDbConnection()

  try {
    if (!db.connected) {
      await db.connect()
    }

    const updatedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
    await db.query(
      `UPDATE "Recognitions" 
       SET "metaData" = $1, "updatedAt" = $2
       WHERE "photoId" = $3`,
      [metaData, updatedAt, photoId]
    )

    console.log(`✅ Updated recognitions for ${photoId}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to update recognitions for ${photoId}:`, error.message)
    return false
  }
}

async function main() {
  try {
    console.log('\n🚀 Starting photo recognition population...\n')
    const photos = await getPhotosWithoutRecognitions()

    if (photos.length === 0) {
      console.log('🎉 All photos already have recognitions!')
      process.exit(0)
    }

    const totalResults = { processed: 0, updated: 0, skipped: 0, errors: 0 }

    console.log(`\n📦 Processing ${photos.length} photos one at a time...`)

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]

      console.log(`\n� Processing photo ${i + 1}/${photos.length}: ${photo.id}`)

      try {
        const recognitions = await generateImageRecognitions(photo.id)

        if (recognitions) {
          const success = await saveRecognitions(photo.id, recognitions)
          if (success) {
            totalResults.updated++
            console.log(`✅ Successfully processed ${photo.id}`)
          } else {
            totalResults.errors++
            console.log(`❌ Failed to save ${photo.id}`)
          }
        } else {
          totalResults.skipped++
          console.log(`⏭️  Skipped ${photo.id}`)
        }
        totalResults.processed++

        // Small delay between photos to avoid overwhelming services
        if (i < photos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        totalResults.errors++
        totalResults.processed++
        console.error(`❌ Error processing photo ${photo.id}:`, error.message)
      }
    }

    if (dbPool) {
      try {
        await dbPool.clean()
        console.log('🧹 Database connection cleaned up')
      } catch (error) {
        console.log('⚠️  Error cleaning up database connection:', error.message)
      }
    }

    console.log('\n🎉 Photo recognition population completed!')
    console.log(`📊 Final results:`)
    console.log(`   • Total photos processed: ${totalResults.processed}`)
    console.log(`   • Successfully updated: ${totalResults.updated}`)
    console.log(`   • Skipped: ${totalResults.skipped}`)
    console.log(`   • Errors: ${totalResults.errors}`)
    if (DRY_RUN) {
      console.log('\n🔍 This was a dry run. No actual updates were made.')
    }
    console.log('\n✅ Script completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('💥 Script failed:', error.message)
    process.exit(1)
  }
}
main().catch(error => {
  console.error('💥 Unhandled error:', error)
  process.exit(1)
}).finally(() => {
  setTimeout(() => {
    process.exit(0)
  }, 1000)
})