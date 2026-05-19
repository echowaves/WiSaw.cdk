'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Migration: Add anchor columns to Waves table')

    await queryInterface.addColumn('Waves', 'anchorLocality', {
      type: Sequelize.STRING,
      allowNull: true
    })

    await queryInterface.addColumn('Waves', 'anchorDistrict', {
      type: Sequelize.STRING,
      allowNull: true
    })

    await queryInterface.addColumn('Waves', 'anchorRegion', {
      type: Sequelize.STRING,
      allowNull: true
    })

    await queryInterface.addColumn('Waves', 'anchorCountry', {
      type: Sequelize.STRING,
      allowNull: true
    })

    console.log('✅ Migration complete: Added anchor columns to Waves')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rollback: Remove anchor columns from Waves')

    await queryInterface.removeColumn('Waves', 'anchorCountry')
    await queryInterface.removeColumn('Waves', 'anchorRegion')
    await queryInterface.removeColumn('Waves', 'anchorDistrict')
    await queryInterface.removeColumn('Waves', 'anchorLocality')

    console.log('✅ Rollback complete')
  }
}
