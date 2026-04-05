'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Creating WaveBans table')

    await queryInterface.createTable('WaveBans', {
      waveUuid: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Waves',
          key: 'waveUuid',
        },
        onDelete: 'CASCADE',
      },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      bannedBy: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })

    console.log('📝 Adding composite primary key to WaveBans...')
    await queryInterface.addConstraint('WaveBans', {
      fields: ['waveUuid', 'uuid'],
      type: 'primary key',
      name: 'WaveBans_pkey',
    })

    console.log('✅ WaveBans table created')
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Dropping WaveBans table')
    await queryInterface.dropTable('WaveBans')
    console.log('✅ WaveBans table dropped')
  },
}
