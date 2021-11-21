module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('Friendships', {
      friendshipUuid: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
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
      // .then(() => queryInterface.addIndex('Friendships', ['friendshipUuid',], {unique: true,}))
      .then(() => queryInterface.addIndex('Friendships', ['chatUuid',], {unique: true,}))

      .then(() => queryInterface.createTable('Friends', {
        friendshipUuid: {
          type: Sequelize.UUID,
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
      }))
      .then(() => queryInterface.addIndex('Friends', ['friendshipUuid',]))
      .then(() => queryInterface.addIndex('Friends', ['uuid',]))

  ,
  down: (queryInterface, Sequelize) => // eslint-disable-line no-unused-vars
    queryInterface.dropTable('Friendships')
      .then(() => queryInterface.dropTable('Friends')
      )
  ,
}
