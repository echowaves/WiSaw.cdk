module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addColumn(
      'Photos',
      'watchersCount',
      {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    ),

  down: (queryInterface, Sequelize) => { // eslint-disable-line no-unused-vars
    queryInterface.removeColumn('Photos', 'watchersCount')
  },
}
