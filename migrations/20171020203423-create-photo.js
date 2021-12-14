module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('Photos', {
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
      location: {
        type: Sequelize.GEOMETRY('POINT'),
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
      .then(() => queryInterface.addIndex('Photos', ['uuid',]))
      .then(() => queryInterface.addIndex('Photos', ['location',]))
      .then(() => queryInterface.addIndex('Photos', ['createdAt',])),
  down: (queryInterface, Sequelize) => // eslint-disable-line no-unused-vars
    queryInterface.dropTable('Photos'),
}
// https://gis.stackexchange.com/questions/159434/resolving-postgis-type-geometry-does-not-exist-issue-on-installing-tiger-geoco
// https://stackoverflow.com/questions/28417409/type-geometry-does-not-exists
