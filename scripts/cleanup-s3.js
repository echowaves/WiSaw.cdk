#!/usr/bin/env node

const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const ServerlessClient = require('serverless-postgres');

// Load environment-specific config (same pattern as your codebase)
const env = process.env.NODE_ENV || 'dev';
const config = require(`./.env.${env}`).config();

// Set NODE_TLS_REJECT_UNAUTHORIZED if specified in config
if (config.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = config.NODE_TLS_REJECT_UNAUTHORIZED;
}

const BUCKET_NAME = config.S3_BUCKET || 'wisaw-img-prod';
const DRY_RUN = process.argv.includes('--dry-run');

const s3 = new S3Client({ region: 'us-east-1' });
const db = new ServerlessClient({
  ...config,  // Use the config object from the env file
  delayMs: 3000,
  maxConnections: 80,
  maxRetries: 3,
  ssl: true,
});

async function getPhotoIds() {
  await db.connect();
  const result = await db.query('SELECT "id" FROM "Photos" WHERE "active" = true');
  await db.clean();
  return new Set(result.rows.map(row => row.id));
}

async function getS3Objects() {
  const objects = [];
  let token = null;
  
  do {
    const response = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: token
    }));
    
    if (response.Contents) {
      objects.push(...response.Contents.map(obj => obj.Key));
    }
    token = response.NextContinuationToken;
  } while (token);
  
  return objects;
}

function extractPhotoId(key) {
  // Extract UUID from keys like: uuid.webp, uuid-thumb.webp, uuid.mov
  const match = key.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
  return match ? match[1] : null;
}

async function main() {
  console.log(`🧹 S3 Cleanup - ${DRY_RUN ? 'DRY RUN' : 'LIVE MODE'}`);
  
  const [photoIds, s3Objects] = await Promise.all([
    getPhotoIds(),
    getS3Objects()
  ]);
  
  console.log(`📊 Found ${photoIds.size} photos in DB, ${s3Objects.length} objects in S3`);
  
  const toDelete = [];
  const unknownObjects = [];
  
  for (const key of s3Objects) {
    const photoId = extractPhotoId(key);
    if (photoId === null) {
      // Object doesn't match UUID pattern - keep track but don't delete
      unknownObjects.push(key);
      toDelete.push(key);
    } else if (!photoIds.has(photoId)) {
      // Object has UUID but not in database - mark for deletion
      toDelete.push(key);
    }
  }
  
  console.log(`� Found ${unknownObjects.length} non-UUID objects (will be deleted)`);
  console.log(`�🗑️  ${toDelete.length} unreferenced  objects to delete`);
  
  if (unknownObjects.length > 0) {
    console.log('\nNon-UUID objects:');
    unknownObjects.slice(0, 5).forEach(key => console.log(`  ${key}`));
    if (unknownObjects.length > 5) {
      console.log(`  ... and ${unknownObjects.length - 5} more`);
    }
  }
  
  if (toDelete.length === 0) {
    console.log('✅ Nothing to delete!');
    return;
  }
  
  if (DRY_RUN) {
    console.log('Objects that would be deleted:');
    // toDelete.forEach(key => console.log(`  ${key}`));
    return;
  }
  
  // Delete objects
  for (const key of toDelete) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      console.log(`✓ Deleted: ${key}`);
    } catch (error) {
      console.error(`✗ Failed to delete ${key}:`, error.message);
    }
  }
  
  console.log('✅ Cleanup complete!');
}

main().catch(console.error);
