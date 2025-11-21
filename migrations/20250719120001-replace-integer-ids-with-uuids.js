module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Starting migration: Replace integer IDs with UUIDs')

    // Remove indexes on old photoId columns first (if they exist)
    console.log('📝 Step 1: Removing indexes on old photoId columns...')
    try {
      console.log('  Removing index on AbuseReports.photoId')
      await queryInterface.removeIndex('AbuseReports', ['photoId'])
    } catch (e) {
      // Index might not exist, continue
    }
    try {
      console.log('  Removing index on Watchers.photoId')
      await queryInterface.removeIndex('Watchers', ['photoId'])
    } catch (e) {
      // Index might not exist, continue
    }
    try {
      console.log('  Removing index on Comments.photoId')
      await queryInterface.removeIndex('Comments', ['photoId'])
    } catch (e) {
      // Index might not exist, continue
    }
    try {
      console.log('  Removing index on Recognitions.photoId')
      await queryInterface.removeIndex('Recognitions', ['photoId'])
    } catch (e) {
      // Index might not exist, continue
    }

    // Drop the old integer photoId columns from related tables
    console.log('📝 Step 2: Dropping old integer photoId columns from related tables...')
    console.log('  Dropping AbuseReports.photoId')
    await queryInterface.removeColumn('AbuseReports', 'photoId')
    console.log('  Dropping Watchers.photoId')
    await queryInterface.removeColumn('Watchers', 'photoId')
    console.log('  Dropping Comments.photoId')
    await queryInterface.removeColumn('Comments', 'photoId')
    console.log('  Dropping Recognitions.photoId')
    await queryInterface.removeColumn('Recognitions', 'photoId')

    // Drop the old integer id column from Photos table (but keep primary key functionality)
    console.log('📝 Step 3: Dropping old integer id column from Photos table...')
    // First remove any indexes on the id column
    try {
      console.log('  Removing index on Photos.id')
      await queryInterface.removeIndex('Photos', ['id'])
    } catch (e) {
      // Index might not exist, continue
    }

    // Remove the old id column
    console.log('  Removing Photos.id column')
    await queryInterface.removeColumn('Photos', 'id')

    // Rename photoUuid columns to the new names
    console.log('📝 Step 4: Renaming photoUuid columns to replace old integer columns...')
    console.log('  Renaming Photos.photoUuid to Photos.id')
    await queryInterface.renameColumn('Photos', 'photoUuid', 'id')
    console.log('  Renaming AbuseReports.photoUuid to AbuseReports.photoId')
    await queryInterface.renameColumn('AbuseReports', 'photoUuid', 'photoId')
    console.log('  Renaming Watchers.photoUuid to Watchers.photoId')
    await queryInterface.renameColumn('Watchers', 'photoUuid', 'photoId')
    console.log('  Renaming Comments.photoUuid to Comments.photoId')
    await queryInterface.renameColumn('Comments', 'photoUuid', 'photoId')
    console.log('  Renaming Recognitions.photoUuid to Recognitions.photoId')
    await queryInterface.renameColumn('Recognitions', 'photoUuid', 'photoId')

    // Add the primary key constraint to the new id column in Photos
    console.log('📝 Step 5: Adding primary key constraint to new Photos.id column...')
    await queryInterface.addConstraint('Photos', {
      fields: ['id'],
      type: 'primary key',
      name: 'Photos_pkey'
    })

    // Add indexes on the new photoId columns
    console.log('📝 Step 6: Adding indexes on new photoId columns...')
    console.log('  Adding index on AbuseReports.photoId')
    await queryInterface.addIndex('AbuseReports', ['photoId'])
    console.log('  Adding index on Watchers.photoId')
    await queryInterface.addIndex('Watchers', ['photoId'])
    console.log('  Adding index on Comments.photoId')
    await queryInterface.addIndex('Comments', ['photoId'])
    console.log('  Adding index on Recognitions.photoId')
    await queryInterface.addIndex('Recognitions', ['photoId'])

    console.log('✅ Migration completed successfully: Integer IDs replaced with UUIDs')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Starting rollback: Replace UUIDs back with integer IDs')

    // Remove the primary key constraint
    console.log('📝 Step 1: Removing primary key constraint from Photos...')
    await queryInterface.removeConstraint('Photos', 'Photos_pkey')

    // Remove indexes on photoId columns
    console.log('📝 Step 2: Removing indexes on photoId columns...')
    console.log('  Removing index on AbuseReports.photoId')
    await queryInterface.removeIndex('AbuseReports', ['photoId'])
    console.log('  Removing index on Watchers.photoId')
    await queryInterface.removeIndex('Watchers', ['photoId'])
    console.log('  Removing index on Comments.photoId')
    await queryInterface.removeIndex('Comments', ['photoId'])
    console.log('  Removing index on Recognitions.photoId')
    await queryInterface.removeIndex('Recognitions', ['photoId'])

    // Add back photoUuid columns with the UUID values from the current columns
    console.log('📝 Step 3: Adding back photoUuid columns...')
    console.log('  Adding Photos.photoUuid column')
    await queryInterface.addColumn('Photos', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: true,
    })

    console.log('  Adding AbuseReports.photoUuid column')
    await queryInterface.addColumn('AbuseReports', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: true,
    })

    console.log('  Adding Watchers.photoUuid column')
    await queryInterface.addColumn('Watchers', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: true,
    })

    console.log('  Adding Comments.photoUuid column')
    await queryInterface.addColumn('Comments', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: true,
    })

    console.log('  Adding Recognitions.photoUuid column')
    await queryInterface.addColumn('Recognitions', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: true,
    })

    // Copy UUID values to the new photoUuid columns
    console.log('📝 Step 4: Copying UUID values to photoUuid columns...')
    console.log('  Copying Photos.id to Photos.photoUuid')
    await queryInterface.sequelize.query(`UPDATE "Photos" SET "photoUuid" = "id"`)

    console.log('  Copying AbuseReports.photoId to AbuseReports.photoUuid')
    await queryInterface.sequelize.query(`UPDATE "AbuseReports" SET "photoUuid" = "photoId"`)

    console.log('  Copying Watchers.photoId to Watchers.photoUuid')
    await queryInterface.sequelize.query(`UPDATE "Watchers" SET "photoUuid" = "photoId"`)

    console.log('  Copying Comments.photoId to Comments.photoUuid')
    await queryInterface.sequelize.query(`UPDATE "Comments" SET "photoUuid" = "photoId"`)

    console.log('  Copying Recognitions.photoId to Recognitions.photoUuid')
    await queryInterface.sequelize.query(`UPDATE "Recognitions" SET "photoUuid" = "photoId"`)

    // Convert the existing UUID columns to INTEGER by extracting the integer part
    console.log('📝 Step 5: Converting UUID columns to INTEGER...')
    console.log('  Converting Photos.id from UUID to INTEGER')
    await queryInterface.sequelize.query(`
      ALTER TABLE "Photos" 
      ALTER COLUMN "id" TYPE INTEGER USING CAST(SUBSTRING("id"::text FROM 25 FOR 12) AS INTEGER)
    `)

    console.log('  Converting AbuseReports.photoId from UUID to INTEGER')
    await queryInterface.sequelize.query(`
      ALTER TABLE "AbuseReports" 
      ALTER COLUMN "photoId" TYPE INTEGER USING CAST(SUBSTRING("photoId"::text FROM 25 FOR 12) AS INTEGER)
    `)

    console.log('  Converting Watchers.photoId from UUID to INTEGER')
    await queryInterface.sequelize.query(`
      ALTER TABLE "Watchers" 
      ALTER COLUMN "photoId" TYPE INTEGER USING CAST(SUBSTRING("photoId"::text FROM 25 FOR 12) AS INTEGER)
    `)

    console.log('  Converting Comments.photoId from UUID to INTEGER')
    await queryInterface.sequelize.query(`
      ALTER TABLE "Comments" 
      ALTER COLUMN "photoId" TYPE INTEGER USING CAST(SUBSTRING("photoId"::text FROM 25 FOR 12) AS INTEGER)
    `)

    console.log('  Converting Recognitions.photoId from UUID to INTEGER')
    await queryInterface.sequelize.query(`
      ALTER TABLE "Recognitions" 
      ALTER COLUMN "photoId" TYPE INTEGER USING CAST(SUBSTRING("photoId"::text FROM 25 FOR 12) AS INTEGER)
    `)

    // Make columns NOT NULL and set up proper constraints
    console.log('📝 Step 6: Setting up proper constraints and making columns NOT NULL...')
    console.log('  Configuring Photos.id as primary key with auto increment')
    await queryInterface.changeColumn('Photos', 'id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    })

    console.log('  Making AbuseReports.photoId NOT NULL')
    await queryInterface.changeColumn('AbuseReports', 'photoId', {
      type: Sequelize.INTEGER,
      allowNull: false,
    })

    console.log('  Making Watchers.photoId NOT NULL')
    await queryInterface.changeColumn('Watchers', 'photoId', {
      type: Sequelize.INTEGER,
      allowNull: false,
    })

    console.log('  Making Comments.photoId NOT NULL')
    await queryInterface.changeColumn('Comments', 'photoId', {
      type: Sequelize.INTEGER,
      allowNull: false,
    })

    console.log('  Making Recognitions.photoId NOT NULL')
    await queryInterface.changeColumn('Recognitions', 'photoId', {
      type: Sequelize.INTEGER,
      allowNull: false,
    })

    // Add back indexes on integer photoId columns
    console.log('📝 Step 7: Adding back indexes on integer photoId columns...')
    console.log('  Adding index on AbuseReports.photoId')
    await queryInterface.addIndex('AbuseReports', ['photoId'])
    console.log('  Adding index on Watchers.photoId')
    await queryInterface.addIndex('Watchers', ['photoId'])
    console.log('  Adding index on Comments.photoId')
    await queryInterface.addIndex('Comments', ['photoId'])
    console.log('  Adding index on Recognitions.photoId')
    await queryInterface.addIndex('Recognitions', ['photoId'])

    console.log('✅ Rollback completed successfully: UUIDs replaced with integer IDs')
  },
}
