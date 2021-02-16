module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.createTable('Recognitions', {
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
      metaData: {
        type: Sequelize.JSONB,
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
      .then(() => queryInterface.addIndex('Recognitions', ['photoId']))
      .then(() =>
        queryInterface.sequelize.query('CREATE INDEX idx_Recognitions_metaData_full_text ON "Recognitions" USING gist ((to_tsvector(\'English\', "metaData"::text)))'))
      .then(() =>
        queryInterface.sequelize.query('CREATE INDEX idx_Comments_metaData_full_text ON "Comments" USING gist ((to_tsvector(\'English\', "comment"::text)))')),

  down: (queryInterface, Sequelize) => { // eslint-disable-line no-unused-vars
    queryInterface.dropTable('Recognitions')
    return queryInterface.sequelize.query('DROP INDEX idx_Comments_metaData_full_text')
  },

}
