module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addColumn(
      'Photos',
      'video',
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    )
      .then(() => queryInterface.addIndex('Photos', ['video',]))
  ,

  down: (queryInterface, Sequelize) => { // eslint-disable-line no-unused-vars
    queryInterface.removeColumn('Photos', 'video')
  },
}
