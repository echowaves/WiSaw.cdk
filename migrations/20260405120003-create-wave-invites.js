'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Creating WaveInvites table')

    await queryInterface.createTable('WaveInvites', {
      inviteToken: {
        type: Sequelize.STRING(32),
        primaryKey: true,
        allowNull: false,
      },
      waveUuid: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Waves',
          key: 'waveUuid',
        },
        onDelete: 'CASCADE',
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      maxUses: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      useCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })

    console.log('📝 Adding index on WaveInvites.waveUuid...')
    await queryInterface.addIndex('WaveInvites', ['waveUuid'], {
      name: 'idx_WaveInvites_waveUuid',
    })

    console.log('✅ WaveInvites table created')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Dropping WaveInvites table')
    await queryInterface.dropTable('WaveInvites')
    console.log('✅ WaveInvites table dropped')
  },
}
