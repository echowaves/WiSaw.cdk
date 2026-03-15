'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Populating photosCount for existing waves')

    await queryInterface.sequelize.query(`
      UPDATE "Waves" SET "photosCount" = (
        SELECT COUNT(*)
        FROM "WavePhotos"
        JOIN "Photos" ON "Photos"."id" = "WavePhotos"."photoId"
        WHERE "WavePhotos"."waveUuid" = "Waves"."waveUuid"
        AND "Photos"."active" = true
      )
    `)

    console.log('✅ photosCount populated for all waves')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Resetting photosCount to 0 for all waves')

    await queryInterface.sequelize.query(`
      UPDATE "Waves" SET "photosCount" = 0
    `)

    console.log('✅ photosCount reset')
  },
}
