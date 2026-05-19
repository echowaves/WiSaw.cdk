'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Migration: Add isActive column to Waves table')

    await queryInterface.addColumn('Waves', 'isActive', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    })

    console.log('✅ Migration complete: Added isActive to Waves')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rollback: Remove isActive from Waves')

    await queryInterface.removeColumn('Waves', 'isActive')

    console.log('✅ Rollback complete')
  }
}
