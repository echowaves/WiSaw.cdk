'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Recognitions', 'searchableText', {
      type: Sequelize.TEXT,
      allowNull: true
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Recognitions', 'searchableText')
  }
}
