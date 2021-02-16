module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('Watchers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      photoId: {
        type: Sequelize.INTEGER,
        allowNull: false,
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
      watchedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
      .then(() => queryInterface.addIndex('Watchers', ['photoId']))
      .then(() => queryInterface.addIndex('Watchers', ['uuid']))
      .then(() => queryInterface.addIndex('Watchers', ['updatedAt']))
      .then(() => queryInterface.addIndex('Watchers', ['watchedAt'])),
  down: (queryInterface, Sequelize) => // eslint-disable-line no-unused-vars
    queryInterface.dropTable('Watchers'),
}
