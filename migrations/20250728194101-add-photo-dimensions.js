module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'Photos',
        'width',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'Image width in pixels',
        },
      ),
      queryInterface.addColumn(
        'Photos',
        'height',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'Image height in pixels',
        },
      ),
    ])
  },

  down: (queryInterface, Sequelize) => { // eslint-disable-line no-unused-vars
    return Promise.all([
      queryInterface.removeColumn('Photos', 'width'),
      queryInterface.removeColumn('Photos', 'height'),
    ])
  },
}
