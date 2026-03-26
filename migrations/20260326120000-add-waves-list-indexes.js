'use strict'

/* eslint-disable */
module.exports = {
  up: async (queryInterface) => {
    console.log('🔄 Starting migration: Add indexes to optimize listWaves query')

    console.log('📝 Step 1: Adding index on Waves.updatedAt...')
    await queryInterface.addIndex('Waves', ['updatedAt'], {
      name: 'idx_Waves_updatedAt'
    })

    console.log('📝 Step 2: Adding composite index on WaveUsers(uuid, waveUuid)...')
    await queryInterface.addIndex('WaveUsers', ['uuid', 'waveUuid'], {
      name: 'idx_WaveUsers_uuid_waveUuid'
    })

    console.log('✅ Migration completed successfully: listWaves indexes added')
  },

  down: async (queryInterface) => {
    console.log('🔄 Starting rollback: Removing listWaves indexes')

    console.log('📝 Step 1: Removing composite index on WaveUsers(uuid, waveUuid)...')
    await queryInterface.removeIndex('WaveUsers', 'idx_WaveUsers_uuid_waveUuid')

    console.log('📝 Step 2: Removing index on Waves.updatedAt...')
    await queryInterface.removeIndex('Waves', 'idx_Waves_updatedAt')

    console.log('✅ Rollback completed successfully')
  }
}
