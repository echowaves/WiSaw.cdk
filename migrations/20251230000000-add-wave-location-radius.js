/* eslint-disable */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Starting migration: Add location and radius to Waves table')

    // Add location column (PostGIS GEOMETRY POINT)
    console.log('📝 Step 1: Adding location column to Waves...')
    await queryInterface.addColumn('Waves', 'location', {
      type: Sequelize.GEOMETRY('POINT'),
      allowNull: true
    })

    // Add radius column
    console.log('📝 Step 2: Adding radius column to Waves...')
    await queryInterface.addColumn('Waves', 'radius', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 50
    })

    // Add index on location
    console.log('📝 Step 3: Adding index on Waves.location...')
    await queryInterface.addIndex('Waves', ['location'])

    console.log('✅ Migration complete: Added location and radius to Waves table')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rolling back migration: Remove location and radius from Waves table')

    await queryInterface.removeIndex('Waves', ['location'])
    await queryInterface.removeColumn('Waves', 'radius')
    await queryInterface.removeColumn('Waves', 'location')

    console.log('✅ Rollback complete')
  }
}
