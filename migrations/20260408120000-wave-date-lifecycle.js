'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Migrating wave lifecycle: backfill dates, rename columns, drop frozen')

    // Step 1: Backfill NULL startDate from photo dates or createdAt
    console.log('📝 Step 1: Backfilling NULL startDate values...')
    await queryInterface.sequelize.query(`
      UPDATE "Waves"
      SET "startDate" = COALESCE(
        (SELECT MIN("Photos"."createdAt")
         FROM "WavePhotos"
         JOIN "Photos" ON "Photos"."id" = "WavePhotos"."photoId"
         WHERE "WavePhotos"."waveUuid" = "Waves"."waveUuid"),
        "Waves"."createdAt"
      )
      WHERE "startDate" IS NULL
    `)

    // Step 2: Backfill NULL endDate from photo dates or createdAt + 1 month
    console.log('📝 Step 2: Backfilling NULL endDate values...')
    await queryInterface.sequelize.query(`
      UPDATE "Waves"
      SET "endDate" = COALESCE(
        (SELECT MAX("Photos"."createdAt")
         FROM "WavePhotos"
         JOIN "Photos" ON "Photos"."id" = "WavePhotos"."photoId"
         WHERE "WavePhotos"."waveUuid" = "Waves"."waveUuid"),
        "Waves"."createdAt" + INTERVAL '1 month'
      )
      WHERE "endDate" IS NULL
    `)

    // Step 3: Ensure frozen=true waves have endDate in the past
    console.log('📝 Step 3: Ensuring frozen=true waves have endDate in the past...')
    await queryInterface.sequelize.query(`
      UPDATE "Waves"
      SET "endDate" = COALESCE(
        (SELECT MAX("Photos"."createdAt")
         FROM "WavePhotos"
         JOIN "Photos" ON "Photos"."id" = "WavePhotos"."photoId"
         WHERE "WavePhotos"."waveUuid" = "Waves"."waveUuid"),
        "Waves"."createdAt"
      )
      WHERE "frozen" = true
        AND ("endDate" IS NULL OR "endDate" > NOW())
    `)

    // Step 4: Rename startDate → splashDate
    console.log('📝 Step 4: Renaming startDate → splashDate...')
    await queryInterface.renameColumn('Waves', 'startDate', 'splashDate')

    // Step 5: Rename endDate → freezeDate
    console.log('📝 Step 5: Renaming endDate → freezeDate...')
    await queryInterface.renameColumn('Waves', 'endDate', 'freezeDate')

    // Step 6: Add NOT NULL constraint on splashDate
    console.log('📝 Step 6: Adding NOT NULL constraint on splashDate...')
    await queryInterface.changeColumn('Waves', 'splashDate', {
      type: Sequelize.DATE,
      allowNull: false,
    })

    // Step 7: Add NOT NULL constraint on freezeDate
    console.log('📝 Step 7: Adding NOT NULL constraint on freezeDate...')
    await queryInterface.changeColumn('Waves', 'freezeDate', {
      type: Sequelize.DATE,
      allowNull: false,
    })

    // Step 8: Drop frozen column
    console.log('📝 Step 8: Dropping frozen column...')
    await queryInterface.removeColumn('Waves', 'frozen')

    console.log('✅ Wave lifecycle migration complete')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Reverting wave lifecycle migration')

    // Step 1: Re-add frozen column
    console.log('📝 Step 1: Re-adding frozen column...')
    await queryInterface.addColumn('Waves', 'frozen', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    })

    // Step 2: Remove NOT NULL constraint on freezeDate
    console.log('📝 Step 2: Removing NOT NULL constraint on freezeDate...')
    await queryInterface.changeColumn('Waves', 'freezeDate', {
      type: Sequelize.DATE,
      allowNull: true,
    })

    // Step 3: Remove NOT NULL constraint on splashDate
    console.log('📝 Step 3: Removing NOT NULL constraint on splashDate...')
    await queryInterface.changeColumn('Waves', 'splashDate', {
      type: Sequelize.DATE,
      allowNull: true,
    })

    // Step 4: Rename freezeDate → endDate
    console.log('📝 Step 4: Renaming freezeDate → endDate...')
    await queryInterface.renameColumn('Waves', 'freezeDate', 'endDate')

    // Step 5: Rename splashDate → startDate
    console.log('📝 Step 5: Renaming splashDate → startDate...')
    await queryInterface.renameColumn('Waves', 'splashDate', 'startDate')

    console.log('✅ Wave lifecycle migration reverted')
  },
}
