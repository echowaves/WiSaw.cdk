module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addColumn(
      'Messages',
      'image',
      {
        type: Sequelize.STRING,
        allowNull: true,
      },
    )
      .then(() =>
        queryInterface.addColumn(
          'Messages',
          'pending',
          {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
        )
      )
      .then(() => queryInterface.addIndex('Messages', ['image',]))
  ,

  down: (queryInterface, Sequelize) => // eslint-disable-line no-unused-vars
    queryInterface.removeColumn('Messages', 'image')
      .then(() =>
        queryInterface.removeColumn('Messages', 'pending')
      ),
}
