'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Migration: Backfill anchor columns from existing wave data')
    const sequelize = queryInterface.sequelize

     // Backfill anchor columns from the first photo's geocode fields in each wave
    await sequelize.query(`
      UPDATE "Waves" AS w
      SET
          "anchorLocality" = sub.locality,
          "anchorDistrict" = sub.district,
          "anchorRegion" = sub.region,
          "anchorCountry" = sub.country
      FROM (
        SELECT DISTINCT ON (w2."waveUuid")
            w2."waveUuid",
            p."locality",
            p."district",
            p."region",
            p."country"
        FROM "Waves" w2
        LEFT JOIN "WavePhotos" wp ON wp."waveUuid" = w2."waveUuid"
        LEFT JOIN "Photos" p ON p."id" = wp."photoId"
        WHERE p."locality" IS NOT NULL
        ORDER BY w2."waveUuid", p."createdAt" ASC
        ) AS sub
      WHERE w."waveUuid" = sub."waveUuid"
        AND w."anchorLocality" IS NULL
      `)

    console.log('✅ Migration complete: Backfilled anchor columns for all waves')
   },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rollback: Clear anchor columns')
    await queryInterface.sequelize.query(`
      UPDATE "Waves" SET
         "anchorLocality" = NULL,
         "anchorDistrict" = NULL,
         "anchorRegion" = NULL,
         "anchorCountry" = NULL
      WHERE "anchorLocality" IS NOT NULL
     `)
    console.log('✅ Rollback complete')
   }
}
