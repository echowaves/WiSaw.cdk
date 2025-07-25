const { S3Client, HeadObjectCommand, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Query to get photos for processing - using WHERE clause to limit for testing
const PHOTOS_QUERY = `SELECT "id", "photoUuid" FROM "Photos" order by "id"`;

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Starting S3 object renaming migration');
    
    // Configure AWS SDK v3
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    console.log(`Configured AWS SDK for region: ${process.env.AWS_REGION || 'us-east-1'}`);

    const bucketName = 'wisaw-img-prod';
    console.log(`Target S3 bucket: ${bucketName}`);

    // Get all photos with their id and photoUuid
    console.log('Querying Photos table for id and photoUuid...');
    const [photos] = await queryInterface.sequelize.query(PHOTOS_QUERY);

    console.log(`Found ${photos.length} photos to process`);

    for (const photo of photos) {
      const oldId = String(photo.id); // Ensure it's a string
      const newUuid = String(photo.photoUuid); // Ensure it's a string

      console.log(`\n--- Processing photo: ${oldId} -> ${newUuid} ---`);
      console.log(`  oldId type: ${typeof oldId}, value: ${oldId}`);
      console.log(`  newUuid type: ${typeof newUuid}, value: ${newUuid}`);

      try {
        // Run all rename operations in parallel for better performance
        console.log('Starting parallel S3 operations...');
        await Promise.all([
          // 1. Rename main image: id -> photoUuid.webp
          renameS3Object(s3Client, bucketName, oldId, `${newUuid}.webp`),
          // 2. Rename thumbnail: id-thumb -> photoUuid-thumb.webp
          renameS3Object(s3Client, bucketName, `${oldId}-thumb`, `${newUuid}-thumb.webp`),
          // 3. Rename video: id.mov -> photoUuid.mov
          renameS3Object(s3Client, bucketName, `${oldId}.mov`, `${newUuid}.mov`)
        ]);
        console.log(`✓ Completed all operations for photo ${oldId}`);

      } catch (error) {
        console.error(`✗ Error processing photo ${oldId}:`, error.message);
        // Continue with next photo instead of failing entire migration
      }
    }

    console.log('\n✓ S3 object renaming migration completed successfully');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('Starting S3 object renaming reversal migration');
    
    // Configure AWS SDK v3
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    console.log(`Configured AWS SDK for region: ${process.env.AWS_REGION || 'us-east-1'}`);

    const bucketName = 'wisaw-img-prod';
    console.log(`Target S3 bucket: ${bucketName}`);

    // Get all photos with their id and photoUuid
    console.log('Querying Photos table for id and photoUuid...');
    const [photos] = await queryInterface.sequelize.query(PHOTOS_QUERY);

    console.log(`Found ${photos.length} photos to reverse process`);

    for (const photo of photos) {
      const oldId = String(photo.id); // Ensure it's a string
      const currentUuid = String(photo.photoUuid); // Ensure it's a string

      console.log(`\n--- Reversing photo: ${currentUuid} -> ${oldId} ---`);
      console.log(`  oldId type: ${typeof oldId}, value: ${oldId}`);
      console.log(`  currentUuid type: ${typeof currentUuid}, value: ${currentUuid}`);

      try {
        // Run all reverse rename operations in parallel for better performance
        console.log('Starting parallel S3 reverse operations...');
        await Promise.all([
          // 1. Rename back: photoUuid.webp -> id
          renameS3Object(s3Client, bucketName, `${currentUuid}.webp`, oldId),
          // 2. Rename back: photoUuid-thumb.webp -> id-thumb
          renameS3Object(s3Client, bucketName, `${currentUuid}-thumb.webp`, `${oldId}-thumb`),
          // 3. Rename back: photoUuid.mov -> id.mov
          renameS3Object(s3Client, bucketName, `${currentUuid}.mov`, `${oldId}.mov`)
        ]);
        console.log(`✓ Completed all reverse operations for photo ${currentUuid}`);

      } catch (error) {
        console.error(`✗ Error reversing photo ${currentUuid}:`, error.message);
        // Continue with next photo instead of failing entire migration
      }
    }

    console.log('\n✓ S3 object renaming reversal migration completed successfully');
  },
};

// Helper function to rename S3 objects using AWS SDK v3 (copy + delete is the only way)
async function renameS3Object(s3Client, bucketName, oldKey, newKey) {
  try {
    console.log(`  Checking if object exists: ${oldKey}`);
    // Check if source object exists
    await s3Client.send(new HeadObjectCommand({ 
      Bucket: bucketName, 
      Key: oldKey 
    }));
    console.log(`  ✓ Object found: ${oldKey}`);
    
    console.log(`  Copying object: ${oldKey} -> ${newKey}`);
    // Copy object to new key with metadata preservation
    await s3Client.send(new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: `${bucketName}/${oldKey}`,
      Key: newKey,
      MetadataDirective: 'COPY', // Preserves original metadata
    }));
    console.log(`  ✓ Copy completed: ${oldKey} -> ${newKey}`);

    console.log(`  Deleting old object: ${oldKey}`);
    // Delete old object
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: oldKey,
    }));
    console.log(`  ✓ Delete completed: ${oldKey}`);

    console.log(`✓ Successfully renamed: ${oldKey} -> ${newKey}`);
  } catch (error) {
    if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
      console.log(`  ⚠ Object not found (skipping): ${oldKey}`);
    } else {
      console.error(`  ✗ Error processing ${oldKey}:`, error.message);
      throw error;
    }
  }
}
