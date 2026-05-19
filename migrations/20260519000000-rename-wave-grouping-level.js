'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Renaming "Waves.granularity" → "Waves.groupingLevel"')
    await queryInterface.renameColumn('Waves', 'granularity', 'groupingLevel')
    console.log('✅ Done: "Waves.groupingLevel" column created')
  },

  down: async (queryInterface) => {
    console.log('🔄 Rolling back: renaming "Waves.groupingLevel" → "Waves.granularity"')
    await queryInterface.renameColumn('Waves', 'groupingLevel', 'granularity')
    console.log('✅ Done: "Waves.granularity" column restored')
  }
}
