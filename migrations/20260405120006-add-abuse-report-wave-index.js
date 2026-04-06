'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('AbuseReports', ['waveUuid', 'createdAt'], {
      name: 'idx_AbuseReports_waveUuid_createdAt',
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('AbuseReports', 'idx_AbuseReports_waveUuid_createdAt')
  },
}
