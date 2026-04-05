'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Adding scheduling and sharing columns to Waves')

    console.log('📝 Step 1: Adding open column...')
    await queryInterface.addColumn('Waves', 'open', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    })

    console.log('📝 Step 2: Adding frozen column...')
    await queryInterface.addColumn('Waves', 'frozen', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    })

    console.log('📝 Step 3: Adding startDate column...')
    await queryInterface.addColumn('Waves', 'startDate', {
      type: Sequelize.DATE,
      allowNull: true,
    })

    console.log('📝 Step 4: Adding endDate column...')
    await queryInterface.addColumn('Waves', 'endDate', {
      type: Sequelize.DATE,
      allowNull: true,
    })

    console.log('✅ Scheduling and sharing columns added')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Removing scheduling and sharing columns from Waves')

    await queryInterface.removeColumn('Waves', 'endDate')
    await queryInterface.removeColumn('Waves', 'startDate')
    await queryInterface.removeColumn('Waves', 'frozen')
    await queryInterface.removeColumn('Waves', 'open')

    console.log('✅ Scheduling and sharing columns removed')
  },
}
