'use strict'

module.exports = {
  up: async (queryInterface) => {
    console.log('🔄 Creating GIN indexes for full-text search')

    console.log('📝 Creating GIN index on Recognitions.metaData')
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_Recognitions_metaData_tsvector
      ON "Recognitions"
      USING GIN (to_tsvector('English', "metaData"::text))
    `)

    console.log('📝 Creating GIN index on Comments.comment')
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_Comments_comment_tsvector
      ON "Comments"
      USING GIN (to_tsvector('English', "comment"::text))
    `)

    console.log('✅ GIN indexes created')
  },

  down: async (queryInterface) => {
    console.log('🔄 Dropping GIN indexes for full-text search')

    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_Comments_comment_tsvector')
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_Recognitions_metaData_tsvector')

    console.log('✅ GIN indexes dropped')
  }
}
