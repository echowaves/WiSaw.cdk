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
          'chatPhotoHash',
          {
            type: Sequelize.STRING,
            allowNull: false,
          },
        ))
      .then(() =>
        queryInterface.changeColumn(
          'Messages', 'createdAt',
          {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.fn('now'),
          }
        ))
      .then(() =>
        queryInterface.changeColumn(
          'Messages', 'updatedAt',
          {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.fn('now'),
          }
        ))
      .then(() => queryInterface.createTable('ChatPhotos', {
        chatPhotoHash: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
        },
        uuid: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('now'),
        },
      }))
      .then(() => queryInterface.addIndex('ChatPhotos', ['uuid',]))
  ,

  down:(queryInterface, Sequelize) =>
    queryInterface.dropTable('ChatPhotos')
      .then(() =>
        queryInterface.removeColumn('Messages', 'pending')
      )
      .then(() =>
        queryInterface.removeColumn('Messages', 'chatPhotoHash')
      )
  ,
}
