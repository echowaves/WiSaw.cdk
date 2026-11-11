module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'Photos',
      'duration',
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Video length in whole seconds, read from the stored container; null when unknown or for photos',
      },
    )
  },

  down: (queryInterface, Sequelize) => { // eslint-disable-line no-unused-vars
    return queryInterface.removeColumn('Photos', 'duration')
  },
}
