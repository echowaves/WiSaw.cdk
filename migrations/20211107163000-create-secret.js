module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('Secrets', {
      uuid: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      nickName: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      secret: {
        type: Sequelize.STRING,
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
      .then(
        () => {
          queryInterface.addIndex(
            'Secrets',
            ['nickName',],
            {unique: true,}
          )
        }
      )
  ,
  down: (queryInterface, Sequelize) => // eslint-disable-line no-unused-vars
    queryInterface.dropTable('Secrets'),
}
