#!/usr/bin/env node

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const ServerlessClient = require('serverless-postgres');
const sharp = require('sharp');

// Parse command line arguments
const args = process.argv.slice(2);
const envArg = args.find(arg => !arg.startsWith('--'));
const env = envArg || process.env.NODE_ENV || 'dev';

// Load environment-specific config (same pattern as your codebase)
const config = require(`../.env.${env}`).config();

// Set NODE_TLS_REJECT_UNAUTHORIZED if specified in config
if (config.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = config.NODE_TLS_REJECT_UNAUTHORIZED;
}

const BUCKET_NAME = config.S3_BUCKET || `wisaw-img-${env}`;
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 10; // Process photos in batches to avoid overwhelming the system

const s3 = new S3Client({ region: 'us-east-1' });

console.log(`🔧 Starting photo dimensions population script`);
console.log(`📊 Environment: ${env}`);
console.log(`🪣 S3 Bucket: ${BUCKET_NAME}`);
console.log(`🌊 Dry run: ${DRY_RUN ? 'YES' : 'NO'}`);
console.log(`📦 Batch size: ${BATCH_SIZE}`);

async function getPhotosWithoutDimensions() {
  const db = new ServerlessClient({
    ...config,
    delayMs: 3000,
    maxConnections: 80,
    maxRetries: 3,
    ssl: true,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });

  try {
    console.log('🔗 Connecting to database...');
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 15000);
    });
    
    const connectPromise = (async () => {
      await db.connect();
      console.log('📊 Running query to get photos without dimensions...');
      const result = await db.query(`
        SELECT "id", "video", "createdAt" 
        FROM "Photos" 
        WHERE "active" = true 
        AND ("width" IS NULL OR "height" IS NULL)
        ORDER BY "createdAt" DESC
      `);
      console.log(`📊 Found ${result.rows.length} photos without dimensions`);
      await db.clean();
      return result.rows;
    })();
    
    return await Promise.race([connectPromise, timeoutPromise]);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

async function getImageDimensions(photoId, isVideo = false) {
  try {

    // Try to get the original uploaded image first, fallback to webp version
    let imageKey = `${photoId}.webp`;
    let imageData;
    
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: imageKey,
      });
      const response = await s3.send(getObjectCommand);
      imageData = await response.Body.transformToByteArray();
    } catch (uploadError) {
      // If .upload file doesn't exist, try the .webp version
      console.log(`❌  upload not found for ${photoId}`);
    }

    // Extract dimensions using Sharp
    const metadata = await sharp(imageData).metadata();
    
    if (metadata.width && metadata.height) {
      console.log(`📐 ${photoId}: ${metadata.width}x${metadata.height}`);
      return {
        width: metadata.width,
        height: metadata.height
      };
    } else {
      console.error(`❌ Could not extract dimensions for ${photoId}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error processing ${photoId}:`, error.message);
    return null;
  }
}

async function updatePhotoDimensions(photoId, width, height) {
  if (DRY_RUN) {
    console.log(`🔍 DRY RUN: Would update ${photoId} with dimensions ${width}x${height}`);
    return true;
  }

  const db = new ServerlessClient({
    ...config,
    delayMs: 3000,
    maxConnections: 80,
    maxRetries: 3,
    ssl: true,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });

  try {
    await db.connect();
    
    const updatedAt = new Date().toISOString().slice(0, 23); // Format: YYYY-MM-DD HH:mm:ss.SSS
    
    await db.query(`
      UPDATE "Photos" 
      SET "width" = $1, "height" = $2, "updatedAt" = $3 
      WHERE "id" = $4
    `, [width, height, updatedAt, photoId]);
    
    await db.clean();
    console.log(`✅ Updated ${photoId} with dimensions ${width}x${height}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update dimensions for ${photoId}:`, error.message);
    return false;
  }
}

async function processBatch(photos) {
  console.log(`\n🔄 Processing batch of ${photos.length} photos...`);
  
  const results = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };

  for (const photo of photos) {
    try {
      const dimensions = await getImageDimensions(photo.id, photo.video);
      results.processed++;
      
      if (dimensions) {
        const success = await updatePhotoDimensions(photo.id, dimensions.width, dimensions.height);
        if (success) {
          results.updated++;
        } else {
          results.errors++;
        }
      } else {
        results.skipped++;
      }
      
      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ Error processing photo ${photo.id}:`, error.message);
      results.errors++;
    }
  }

  return results;
}

async function main() {
  try {
    console.log('\n🚀 Starting photo dimensions population...\n');
    
    // Get all photos without dimensions
    const photos = await getPhotosWithoutDimensions();
    
    if (photos.length === 0) {
      console.log('🎉 All photos already have dimensions!');
      return;
    }

    // Process photos in batches
    const totalResults = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };

    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      const batch = photos.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(photos.length / BATCH_SIZE);
      
      console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (photos ${i + 1}-${Math.min(i + BATCH_SIZE, photos.length)} of ${photos.length})`);
      
      const batchResults = await processBatch(batch);
      
      // Aggregate results
      totalResults.processed += batchResults.processed;
      totalResults.updated += batchResults.updated;
      totalResults.skipped += batchResults.skipped;
      totalResults.errors += batchResults.errors;
      
      // Progress update
      console.log(`📊 Batch ${batchNumber} complete: ${batchResults.updated} updated, ${batchResults.skipped} skipped, ${batchResults.errors} errors`);
      
      // Longer delay between batches
      if (i + BATCH_SIZE < photos.length) {
        console.log('⏸️  Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Final summary
    console.log('\n🎉 Photo dimensions population completed!');
    console.log(`📊 Final results:`);
    console.log(`   • Total photos processed: ${totalResults.processed}`);
    console.log(`   • Successfully updated: ${totalResults.updated}`);
    console.log(`   • Skipped (videos/errors): ${totalResults.skipped}`);
    console.log(`   • Errors: ${totalResults.errors}`);
    
    if (DRY_RUN) {
      console.log('\n🔍 This was a dry run. No actual updates were made.');
      console.log('💡 Run without --dry-run to perform actual updates.');
    }

  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
