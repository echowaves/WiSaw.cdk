'use strict'

module.exports = {
  up: async (queryInterface) => {
    console.log('🔄 Swapping GIN index on Recognitions for FTS')

    console.log('📝 Creating GIN index on searchableText')
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_Recognitions_searchableText_tsvector
      ON "Recognitions"
      USING GIN (to_tsvector('English', "searchableText"))
    `)

    console.log('📝 Dropping old GIN index on metaData')
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_Recognitions_metaData_tsvector')

    console.log('✅ GIN index swap complete')
  },

  down: async (queryInterface) => {
    console.log('🔄 Reverting GIN index swap on Recognitions')

    await queryInterface.sequelize.query(`
      CREATE INDEX idx_Recognitions_metaData_tsvector
      ON "Recognitions"
      USING GIN (to_tsvector('English', "metaData"::text))
    `)

    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_Recognitions_searchableText_tsvector')

    console.log('✅ GIN index reverted')
  }
}
