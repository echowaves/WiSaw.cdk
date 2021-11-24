module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('Friendships', {
      friendshipUuid: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      uuid1: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      uuid2: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      chatUuid: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
      .then(() => queryInterface.addIndex('Friendships', ['chatUuid',], {unique: true,}))
      .then(() => queryInterface.addIndex('Friendships', ['uuid1',]))
      .then(() => queryInterface.addIndex('Friendships', ['uuid2',]))

  ,
  down: (queryInterface, Sequelize) => // eslint-disable-line no-unused-vars
    queryInterface.dropTable('Friendships')
      .then(() => queryInterface.dropTable('Friends')
      )
  ,
}
