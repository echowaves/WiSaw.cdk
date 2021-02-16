module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addColumn(
      'AbuseReports',
      'photoId',
      {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    ),

  down: (queryInterface, Sequelize) => // eslint-disable-line no-unused-vars
    queryInterface.removeColumn('AbuseReports', 'photoId'),
}
