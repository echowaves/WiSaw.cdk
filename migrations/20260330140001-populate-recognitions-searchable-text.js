'use strict'

module.exports = {
  up: async (queryInterface) => {
    console.log('🔄 Backfilling searchableText for Recognitions')

    const batchSize = 1000
    let offset = 0
    let totalUpdated = 0

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const [rows] = await queryInterface.sequelize.query(`
        SELECT id FROM "Recognitions"
        WHERE "searchableText" IS NULL
        ORDER BY id
        LIMIT ${batchSize}
      `)

      if (rows.length === 0) break

      console.log(`📝 Processing batch at offset ${offset}, ${rows.length} rows`)

      await queryInterface.sequelize.query(`
        UPDATE "Recognitions"
        SET "searchableText" = (
          COALESCE(
            CASE WHEN jsonb_typeof("metaData"->'Labels') = 'array' THEN
              (SELECT string_agg(elem->>'Name', ' ')
               FROM jsonb_array_elements("metaData"->'Labels') elem)
            ELSE NULL END, ''
          ) || ' ' ||
          COALESCE(
            CASE WHEN jsonb_typeof("metaData"->'TextDetections') = 'array' THEN
              (SELECT string_agg(elem->>'DetectedText', ' ')
               FROM jsonb_array_elements("metaData"->'TextDetections') elem)
            ELSE NULL END, ''
          )
        )
        WHERE id IN (${rows.map(r => r.id).join(',')})
      `)

      totalUpdated += rows.length
      offset += batchSize
    }

    console.log(`✅ Backfilled ${totalUpdated} Recognitions rows`)
  },

  down: async (queryInterface) => {
    console.log('🔄 Clearing searchableText for all Recognitions')

    await queryInterface.sequelize.query(`
      UPDATE "Recognitions" SET "searchableText" = NULL
    `)

    console.log('✅ searchableText cleared')
  }
}
