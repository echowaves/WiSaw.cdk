'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Starting removal of chat tables and chatUuid column')

    console.log('📝 Dropping Messages table')
    await queryInterface.dropTable('Messages')

    console.log('📝 Dropping ChatPhotos table')
    await queryInterface.dropTable('ChatPhotos')

    console.log('📝 Dropping ChatUsers table')
    await queryInterface.dropTable('ChatUsers')

    console.log('📝 Dropping Chats table')
    await queryInterface.dropTable('Chats')

    console.log('📝 Removing chatUuid column from Friendships')
    await queryInterface.removeColumn('Friendships', 'chatUuid')

    console.log('✅ Chat tables and chatUuid column removed successfully')
  },

  down: async (queryInterface, Sequelize) => {
    throw new Error('Migration is irreversible: chat feature has been permanently removed')
  }
}
