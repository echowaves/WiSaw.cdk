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
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 20; // Increased default batch size
const CONCURRENT_LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--concurrent='))?.split('=')[1]) || 10; // Process multiple photos concurrently within each batch

const s3 = new S3Client({ region: 'us-east-1' });

// Create a shared database connection pool
let dbPool = null;
const getDbConnection = () => {
  if (!dbPool) {
    dbPool = new ServerlessClient({
      ...config,
      delayMs: 1000, // Reduced delay for better performance
      maxConnections: 20, // Reduced max connections
      maxRetries: 2, // Reduced retries for faster failure
      ssl: true,
      connectionTimeoutMillis: 5000, // Reduced timeout
      idleTimeoutMillis: 30000, // Keep connections alive longer
    });
  }
  return dbPool;
};

console.log(`🔧 Starting photo dimensions population script`);
console.log(`📊 Environment: ${env}`);
console.log(`🪣 S3 Bucket: ${BUCKET_NAME}`);
console.log(`🌊 Dry run: ${DRY_RUN ? 'YES' : 'NO'}`);
console.log(`📦 Batch size: ${BATCH_SIZE}`);
console.log(`⚡ Concurrent limit: ${CONCURRENT_LIMIT}`);

async function getPhotosWithoutDimensions() {
  const db = getDbConnection();

  try {
    console.log('🔗 Connecting to database...');
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 10000);
    });
    
    const connectPromise = (async () => {
      await db.connect();
      console.log('📊 Running query to get photos without dimensions...');
      const result = await db.query(`
        SELECT "id", "createdAt" 
        FROM "Photos" 
        WHERE "active" = true 
        AND ("width" IS NULL OR "height" IS NULL)
        ORDER BY "createdAt" DESC
      `);
      console.log(`📊 Found ${result.rows.length} photos without dimensions`);
      // Don't clean the connection, keep it for reuse
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

    // Try .webp first as it's more likely to exist and smaller to download
    let imageKey = `${photoId}.webp`;
    let imageData;
    
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: imageKey,
      });
      const response = await s3.send(getObjectCommand);
      imageData = await response.Body.transformToByteArray();
    } catch (webpError) {
      // If .webp doesn't exist, try the original upload
      console.log(`⚠️  .webp not found for ${photoId}, trying .upload version`);
      imageKey = `${photoId}.upload`;
      try {
        const getObjectCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: imageKey,
        });
        const response = await s3.send(getObjectCommand);
        imageData = await response.Body.transformToByteArray();
      } catch (uploadError) {
        console.error(`❌ Could not find image for ${photoId} (tried .webp and .upload)`);
        return null;
      }
    }

    // Check if we have imageData before processing
    if (!imageData) {
      console.error(`❌ No image data retrieved for ${photoId}`);
      return null;
    }

    // Extract dimensions using Sharp with minimal processing
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

  const db = getDbConnection();

  try {
    // Ensure connection is established (reuse existing connection if available)
    if (!db.connected) {
      await db.connect();
    }
    
    const updatedAt = new Date().toISOString().slice(0, 23); // Format: YYYY-MM-DD HH:mm:ss.SSS
    
    await db.query(`
      UPDATE "Photos" 
      SET "width" = $1, "height" = $2, "updatedAt" = $3 
      WHERE "id" = $4
    `, [width, height, updatedAt, photoId]);
    
    // Don't clean the connection, keep it for reuse
    console.log(`✅ Updated ${photoId} with dimensions ${width}x${height}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update dimensions for ${photoId}:`, error.message);
    return false;
  }
}

// Helper function to process a single photo
async function processPhoto(photo) {
  try {
    const dimensions = await getImageDimensions(photo.id, photo.video);
    
    if (dimensions) {
      const success = await updatePhotoDimensions(photo.id, dimensions.width, dimensions.height);
      return success ? 'updated' : 'error';
    } else {
      return 'skipped';
    }
  } catch (error) {
    console.error(`❌ Error processing photo ${photo.id}:`, error.message);
    return 'error';
  }
}

// Helper function to limit concurrency
async function processConcurrentBatch(photos, limit) {
  const results = [];
  
  for (let i = 0; i < photos.length; i += limit) {
    const batch = photos.slice(i, i + limit);
    const promises = batch.map(photo => processPhoto(photo));
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    
    // Small delay between concurrent batches to avoid overwhelming systems
    if (i + limit < photos.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  return results;
}

async function processBatch(photos) {
  console.log(`\n🔄 Processing batch of ${photos.length} photos...`);
  
  const results = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };

  // Process photos concurrently within the batch
  const batchResults = await processConcurrentBatch(photos, CONCURRENT_LIMIT);
  
  // Count results
  batchResults.forEach(result => {
    results.processed++;
    if (result === 'updated') {
      results.updated++;
    } else if (result === 'skipped') {
      results.skipped++;
    } else if (result === 'error') {
      results.errors++;
    }
  });

  return results;
}

async function main() {
  try {
    console.log('\n🚀 Starting photo dimensions population...\n');
    
    // Get all photos without dimensions
    const photos = await getPhotosWithoutDimensions();
    
    if (photos.length === 0) {
      console.log('🎉 All photos already have dimensions!');
      process.exit(0); // Force exit since db is already cleaned
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
      
      // Shorter delay between batches for better performance
      if (i + BATCH_SIZE < photos.length) {
        console.log('⏸️  Waiting 500ms before next batch...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Clean up database connection
    if (dbPool) {
      try {
        await dbPool.clean();
        console.log('🧹 Database connection cleaned up');
      } catch (error) {
        console.log('⚠️  Error cleaning up database connection:', error.message);
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
    
    console.log('\n💡 Performance tuning options:');
    console.log('   • --batch-size=N : Set batch size (default: 20)');
    console.log('   • --concurrent=N : Set concurrent processing limit (default: 5)');
    console.log('   • Example: npm run populate-dimensions test --batch-size=50 --concurrent=10');

    console.log('\n✅ Script completed successfully!');
    process.exit(0); // Force exit since db is already cleaned

  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
}).finally(() => {
  // Force exit after a short delay to ensure all cleanup is done
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
