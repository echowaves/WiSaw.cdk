'use strict'

/* eslint-disable */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Migration: Remove isActive, fix location index, add composite index')

    // Step 1: Drop isActive column
    console.log('📝 Step 1: Dropping isActive column from Waves...')
    await queryInterface.removeColumn('Waves', 'isActive')

    // Step 2: Drop existing B-tree index on Waves.location, create GiST index
    console.log('📝 Step 2: Replacing B-tree index on Waves.location with GiST...')
    await queryInterface.removeIndex('Waves', ['location'])
    await queryInterface.sequelize.query(
      'CREATE INDEX "idx_Waves_location_gist" ON "Waves" USING GIST ("location")'
    )

    // Step 3: Create composite index on (createdBy, groupingLevel)
    console.log('📝 Step 3: Adding composite index on Waves(createdBy, groupingLevel)...')
    await queryInterface.addIndex('Waves', ['createdBy', 'groupingLevel'], {
      name: 'idx_Waves_createdBy_groupingLevel'
    })

    // Step 4: Drop old single-column createdBy index (subsumed by composite)
    console.log('📝 Step 4: Dropping old single-column createdBy index...')
    await queryInterface.removeIndex('Waves', ['createdBy'])

    console.log('✅ Migration complete')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rollback: Restore isActive, B-tree index, single-column index')

    // Step 1: Re-add single-column createdBy index
    console.log('📝 Step 1: Re-adding single-column createdBy index...')
    await queryInterface.addIndex('Waves', ['createdBy'])

    // Step 2: Drop composite index
    console.log('📝 Step 2: Dropping composite index...')
    await queryInterface.removeIndex('Waves', 'idx_Waves_createdBy_groupingLevel')

    // Step 3: Drop GiST index, re-add B-tree
    console.log('📝 Step 3: Replacing GiST index with B-tree on Waves.location...')
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "idx_Waves_location_gist"')
    await queryInterface.addIndex('Waves', ['location'])

    // Step 4: Re-add isActive column
    console.log('📝 Step 4: Re-adding isActive column...')
    await queryInterface.addColumn('Waves', 'isActive', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    })

    console.log('✅ Rollback complete')
  }
}
