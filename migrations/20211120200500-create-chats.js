module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('Chats', {
      chatUuid: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
      // .then(() => queryInterface.addIndex('Chats', ['chatUuid',], {unique: true,}))
      .then(() => queryInterface.createTable('ChatUsers', {
        chatUuid: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        uuid: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        invitedByUuid: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        lastReadAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
      }))
      .then(() => queryInterface.addIndex('ChatUsers', ['chatUuid',]))
      .then(() => queryInterface.addIndex('ChatUsers', ['uuid',]))

      .then(() => queryInterface.createTable('Messages', {
        chatUuid: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        uuid: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        messageUuid: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        message: {
          type: Sequelize.TEXT,
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
      }))
      .then(() => queryInterface.addIndex('Messages', ['chatUuid',]))
      // .then(() => queryInterface.addIndex('Messages', ['uuid',]))
      .then(() => queryInterface.addIndex('Messages', ['createdAt',]))

  ,
  down: (queryInterface, Sequelize) => // eslint-disable-line no-unused-vars
    queryInterface.dropTable('Chats')
      .then(() => queryInterface.dropTable('ChatUsers'))
      .then(() => queryInterface.dropTable('Messages'))
  ,
}
