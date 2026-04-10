'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Adding wave context columns to AbuseReports')

    console.log('📝 Step 1: Adding waveUuid column...')
    await queryInterface.addColumn('AbuseReports', 'waveUuid', {
      type: Sequelize.UUID,
      allowNull: true,
    })

    console.log('📝 Step 2: Adding status column...')
    await queryInterface.addColumn('AbuseReports', 'status', {
      type: Sequelize.STRING(12),
      allowNull: false,
      defaultValue: 'pending',
    })

    console.log('📝 Step 3: Adding reviewedBy column...')
    await queryInterface.addColumn('AbuseReports', 'reviewedBy', {
      type: Sequelize.UUID,
      allowNull: true,
    })

    console.log('📝 Step 4: Adding reviewedAt column...')
    await queryInterface.addColumn('AbuseReports', 'reviewedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    })

    console.log('✅ Wave context columns added to AbuseReports')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Removing wave context columns from AbuseReports')

    await queryInterface.removeColumn('AbuseReports', 'reviewedAt')
    await queryInterface.removeColumn('AbuseReports', 'reviewedBy')
    await queryInterface.removeColumn('AbuseReports', 'status')
    await queryInterface.removeColumn('AbuseReports', 'waveUuid')

    console.log('✅ Wave context columns removed from AbuseReports')
  },
}
