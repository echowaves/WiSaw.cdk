module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addIndex('ChatUsers', ['lastReadAt',])
  ,
  down: (queryInterface, Sequelize) => // eslint-disable-line no-unused-vars
    queryInterface.removeIndex('ChatUsers', ['lastReadAt',])
  ,
}
