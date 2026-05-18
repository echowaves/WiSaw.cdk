'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Adding "granularity" column to "Waves" table')
    await queryInterface.addColumn('Waves', 'granularity', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'CITY'
    })
    console.log('✅ Done: "granularity" column added to "Waves" table')
  },

  down: async (queryInterface) => {
    console.log('🔄 Rolling back: removing "granularity" column from "Waves" table')
    await queryInterface.removeColumn('Waves', 'granularity')
    console.log('✅ Done: "granularity" column removed from "Waves" table')
  }
}
