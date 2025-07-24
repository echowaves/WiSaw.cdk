module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Adding photoUuid columns to relevant tables');

    console.log('Adding photoUuid column to Photos');
    await queryInterface.addColumn(
        'Photos',
        'photoUuid',
        {
            type: Sequelize.UUID,
            allowNull: true, // Initially allow null, will be populated then made NOT NULL
        }
    );

    console.log('Adding photoUuid column to AbuseReports');
    await queryInterface.addColumn(
        'AbuseReports',
        'photoUuid',
        {
            type: Sequelize.UUID,
            allowNull: true, // Initially allow null, will be populated then made NOT NULL
        }
    );

    console.log('Adding photoUuid column to Watchers');
    await queryInterface.addColumn(
        'Watchers',
        'photoUuid',
        {
            type: Sequelize.UUID,
            allowNull: true, // Initially allow null, will be populated then made NOT NULL
        }
    );

    console.log('Adding photoUuid column to Comments');
    await queryInterface.addColumn(
        'Comments',
        'photoUuid',
        {
            type: Sequelize.UUID,
            allowNull: true, // Initially allow null, will be populated then made NOT NULL
        }
    );

    console.log('Adding photoUuid column to Recognitions');
    await queryInterface.addColumn(
        'Recognitions',
        'photoUuid',
        {
            type: Sequelize.UUID,
            allowNull: true, // Initially allow null, will be populated then made NOT NULL
        }
    );

    console.log('Adding indexes on new UUID columns');
    await queryInterface.addIndex('Photos', ['photoUuid']);
    await queryInterface.addIndex('AbuseReports', ['photoUuid']);
    await queryInterface.addIndex('Watchers', ['photoUuid']);
    await queryInterface.addIndex('Comments', ['photoUuid']);
    await queryInterface.addIndex('Recognitions', ['photoUuid']);

    console.log('Completed adding photoUuid columns and indexes');
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Photos', 'photoUuid')
        .then(() => queryInterface.removeColumn('AbuseReports', 'photoUuid'))
        .then(() => queryInterface.removeColumn('Watchers', 'photoUuid'))
        .then(() => queryInterface.removeColumn('Comments', 'photoUuid'))
        .then(() => queryInterface.removeColumn('Recognitions', 'photoUuid'));
  }
};
