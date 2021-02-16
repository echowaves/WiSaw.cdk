module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addColumn(
      'Photos',
      'active',
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    )
      .then(() => queryInterface.addIndex('Photos', ['active'])),

  down: (queryInterface, Sequelize) => // eslint-disable-line no-unused-vars
    queryInterface.removeColumn('Photos', 'active'),
}
