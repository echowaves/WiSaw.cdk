'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Migration: Add locality columns to Photos table')

    await queryInterface.addColumn('Photos', 'localityLevel', {
      type: Sequelize.STRING,
      allowNull: true,
     })


    await queryInterface.addColumn('Photos', 'locality', {
      type: Sequelize.STRING,
      allowNull: true,
     })

    await queryInterface.addColumn('Photos', 'region', {
      type: Sequelize.STRING,
      allowNull: true,
     })

    await queryInterface.addColumn('Photos', 'country', {
      type: Sequelize.STRING,
      allowNull: true,
     })

    await queryInterface.addColumn('Photos', 'countryCode', {
      type: Sequelize.STRING,
      allowNull: true,
     })

    console.log('✅ Migration complete: Added locality columns to Photos')
   },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rollback: Remove locality columns from Photos')

    await queryInterface.removeColumn('Photos', 'countryCode')
    await queryInterface.removeColumn('Photos', 'country')
    await queryInterface.removeColumn('Photos', 'region')
    await queryInterface.removeColumn('Photos', 'localityLevel')
    await queryInterface.removeColumn('Photos', 'locality')

    console.log('✅ Rollback complete')
   },
}
