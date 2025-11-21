module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('Starting to populate photoUuid columns')
    
    // First, populate photoUuid in Photos table by converting its own id to UUID format
    console.log('Populating photoUuid in Photos table')
    await queryInterface.sequelize.query(`
      UPDATE "Photos" 
      SET "photoUuid" = ('00000000-0000-0000-0000-' || lpad("id"::text, 12, '0'))::uuid
    `)

    // Populate photoUuid in AbuseReports using the same conversion pattern
    console.log('Populating photoUuid in AbuseReports table')
    await queryInterface.sequelize.query(`
      UPDATE "AbuseReports" 
      SET "photoUuid" = ('00000000-0000-0000-0000-' || lpad("photoId"::text, 12, '0'))::uuid
    `)

    // Populate photoUuid in Watchers using the same conversion pattern
    console.log('Populating photoUuid in Watchers table')
    await queryInterface.sequelize.query(`
      UPDATE "Watchers" 
      SET "photoUuid" = ('00000000-0000-0000-0000-' || lpad("photoId"::text, 12, '0'))::uuid
    `)

    // Populate photoUuid in Comments using the same conversion pattern
    console.log('Populating photoUuid in Comments table')
    await queryInterface.sequelize.query(`
      UPDATE "Comments" 
      SET "photoUuid" = ('00000000-0000-0000-0000-' || lpad("photoId"::text, 12, '0'))::uuid
    `)

    // Populate photoUuid in Recognitions using the same conversion pattern
    console.log('Populating photoUuid in Recognitions table')
    await queryInterface.sequelize.query(`
      UPDATE "Recognitions" 
      SET "photoUuid" = ('00000000-0000-0000-0000-' || lpad("photoId"::text, 12, '0'))::uuid
    `)

    // Now make all photoUuid columns NOT NULL since they're populated
    console.log('Making photoUuid columns NOT NULL')
    await queryInterface.changeColumn('Photos', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: false
    })

    console.log('Setting AbuseReports.photoUuid to NOT NULL')
    await queryInterface.changeColumn('AbuseReports', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: false
    })

    console.log('Setting Watchers.photoUuid to NOT NULL')
    await queryInterface.changeColumn('Watchers', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: false
    })

    console.log('Setting Comments.photoUuid to NOT NULL')
    await queryInterface.changeColumn('Comments', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: false
    })

    console.log('Setting Recognitions.photoUuid to NOT NULL')
    await queryInterface.changeColumn('Recognitions', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: false
    })

    console.log('Completed populating photoUuid columns and setting NOT NULL constraints')
  },

  down: async (queryInterface, Sequelize) => {
    // First make all photoUuid columns allow NULL
    console.log('Making photoUuid columns allow NULL')
    await queryInterface.changeColumn('Photos', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: true
    })

    await queryInterface.changeColumn('AbuseReports', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: true
    })

    await queryInterface.changeColumn('Watchers', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: true
    })

    await queryInterface.changeColumn('Comments', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: true
    })

    await queryInterface.changeColumn('Recognitions', 'photoUuid', {
      type: Sequelize.UUID,
      allowNull: true
    })

    // Now clear all photoUuid values
    await queryInterface.sequelize.query(`UPDATE "Photos" SET "photoUuid" = NULL`)
    await queryInterface.sequelize.query(`UPDATE "AbuseReports" SET "photoUuid" = NULL`)
    await queryInterface.sequelize.query(`UPDATE "Watchers" SET "photoUuid" = NULL`)
    await queryInterface.sequelize.query(`UPDATE "Comments" SET "photoUuid" = NULL`)
    await queryInterface.sequelize.query(`UPDATE "Recognitions" SET "photoUuid" = NULL`)
  }
}
