module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addColumn(
      'ChatUsers',
      'updatedAt',
      {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
    )
      .then(() => queryInterface.addIndex('ChatUsers', ['updatedAt',]))
  ,

  down: (queryInterface, Sequelize) => // eslint-disable-line no-unused-vars
    queryInterface.removeColumn('ChatUsers', 'updatedAt'),
}
