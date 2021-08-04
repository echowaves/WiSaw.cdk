module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addColumn(
      'Photos',
      'lastComment',
      {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },
    ),

  down: (queryInterface, Sequelize) => { // eslint-disable-line no-unused-vars
    queryInterface.removeColumn('Photos', 'lastComment')
  },
}
