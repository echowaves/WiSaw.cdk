module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addColumn(
      'Messages',
      'pending',
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    )
      .then(() =>
        queryInterface.addColumn(
          'Messages',
          'chatPhotoUuid',
          {
            type: Sequelize.UUID,
            allowNull: true,
          },
        ))

      .then(() => queryInterface.createTable('ChatPhotos', {
        chatPhotoUuid: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
        },
        uuid: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        contentHash: {
          allowNull: false,
          type: Sequelize.STRING,
        },

        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('now'),
        },
      }))
      .then(() => queryInterface.addIndex('ChatPhotos', ['uuid',]))
      .then(() => queryInterface.addIndex('ChatPhotos', ['contentHash',]))
  ,

  down:(queryInterface, Sequelize) =>
    queryInterface.dropTable('ChatPhotos')
      .then(() =>
        queryInterface.removeColumn('Messages', 'pending')
      )
      .then(() =>
        queryInterface.removeColumn('Messages', 'chatPhotoUuid')
      )
  ,
}
