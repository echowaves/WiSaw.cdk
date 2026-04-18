'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Adding freezeMode column to Waves')

    console.log('📝 Step 1: Adding freezeMode column with AUTO default...')
    await queryInterface.addColumn('Waves', 'freezeMode', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'AUTO'
    })

    console.log('📝 Step 2: Backfilling NULL freezeMode values to AUTO...')
    await queryInterface.sequelize.query(`
      UPDATE "Waves"
      SET "freezeMode" = 'AUTO'
      WHERE "freezeMode" IS NULL
    `)

    console.log('📝 Step 3: Verifying freezeMode backfill...')
    const verification = await queryInterface.sequelize.query(`
      SELECT COUNT(*)::int AS "nullCount"
      FROM "Waves"
      WHERE "freezeMode" IS NULL
    `)
    const nullCount = verification[0][0].nullCount

    if (nullCount > 0) {
      throw new Error(`Backfill failed: ${nullCount} Waves rows still have NULL freezeMode`)
    }

    console.log('✅ freezeMode column added and verified')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Removing freezeMode column from Waves')

    await queryInterface.removeColumn('Waves', 'freezeMode')

    console.log('✅ freezeMode column removed')
  }
}
