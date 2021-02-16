module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addColumn(
      'Photos',
      'likes',
      {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    )
      .then(() => queryInterface.addIndex('Photos', ['likes']))
      .then(() => queryInterface.addIndex('Photos', ['updatedAt'])),

  down: (queryInterface, Sequelize) => { // eslint-disable-line no-unused-vars
    queryInterface.removeColumn('Photos', 'likes')
    queryInterface.removeIndex('Photos', ['updatedAt'])
  },
}
