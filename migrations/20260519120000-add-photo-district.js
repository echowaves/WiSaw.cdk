'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Migration: Add district column to Photos table')

    await queryInterface.addColumn('Photos', 'district', {
      type: Sequelize.STRING,
      allowNull: true,
    })

    console.log('✅ Migration complete: Added district column to Photos')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rollback: Remove district column from Photos')

    await queryInterface.removeColumn('Photos', 'district')

    console.log('✅ Rollback complete')
  },
}
