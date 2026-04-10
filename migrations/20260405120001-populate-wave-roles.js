'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Populating wave roles for existing wave creators')

    await queryInterface.sequelize.query(`
      UPDATE "WaveUsers" wu
      SET "role" = 'owner'
      FROM "Waves" w
      WHERE wu."waveUuid" = w."waveUuid"
        AND wu."uuid" = w."createdBy"
    `)

    console.log('✅ Wave roles populated')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Resetting all wave roles to contributor')

    await queryInterface.sequelize.query(`
      UPDATE "WaveUsers" SET "role" = 'contributor'
    `)

    console.log('✅ Wave roles reset')
  },
}
