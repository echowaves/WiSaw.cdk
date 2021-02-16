module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addColumn(
      'Photos',
      'commentsCount',
      {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    ),

  down: (queryInterface, Sequelize) => { // eslint-disable-line no-unused-vars
    queryInterface.removeColumn('Photos', 'commentsCount')
  },
}
