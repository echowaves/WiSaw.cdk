'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('WaveUsers', 'role', {
      type: Sequelize.STRING(12),
      allowNull: false,
      defaultValue: 'contributor',
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('WaveUsers', 'role')
  },
}
