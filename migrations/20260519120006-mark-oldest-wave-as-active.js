'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Migration: Mark oldest wave per user as isActive=true, all others as isActive=false')
    const sequelize = queryInterface.sequelize

    // Mark only the oldest wave per user as active
    await sequelize.query(`
      UPDATE "Waves" SET "isActive" = false
      WHERE "waveUuid" NOT IN (
        SELECT DISTINCT ON ("createdBy") "waveUuid"
        FROM "Waves"
        ORDER BY "createdBy", "createdAt" ASC
      )
    `)

    console.log('✅ Migration complete: Marked oldest wave per user as active')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rollback: Reset all waves to isActive=true')
    await queryInterface.sequelize.query(`
      UPDATE "Waves" SET "isActive" = true
    `)
    console.log('✅ Rollback complete')
  }
}
