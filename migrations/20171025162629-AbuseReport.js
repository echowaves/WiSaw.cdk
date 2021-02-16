module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('AbuseReports', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
      .then(() => queryInterface.addIndex('AbuseReports', ['uuid']))
      .then(() => queryInterface.addIndex('AbuseReports', ['createdAt'])),
  down: (queryInterface, Sequelize) => // eslint-disable-line no-unused-vars
    queryInterface.dropTable('AbuseReports'),
}
