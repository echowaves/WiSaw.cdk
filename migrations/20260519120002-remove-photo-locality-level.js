'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Migration: Remove locality_level column from Photos table')

    await queryInterface.removeColumn('Photos', 'localityLevel')

    console.log('✅ Migration complete: Removed locality_level from Photos')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rollback: Add locality_level column back to Photos')

    await queryInterface.addColumn('Photos', 'localityLevel', {
      type: Sequelize.STRING,
      allowNull: true
    })

    console.log('✅ Rollback complete')
  }
}
