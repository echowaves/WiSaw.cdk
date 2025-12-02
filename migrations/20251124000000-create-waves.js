/* eslint-disable */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Starting migration: Create Waves and WavePhotos tables')

    // Create Waves table
    console.log('📝 Step 1: Creating Waves table...')
    await queryInterface.createTable('Waves', {
      waveUuid: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    })

    // Add index on createdBy in Waves
    console.log('📝 Step 2: Adding index on Waves.createdBy...')
    await queryInterface.addIndex('Waves', ['createdBy'])
    console.log('📝 Step 2.1: Adding index on Waves.createdAt...')
    await queryInterface.addIndex('Waves', ['createdAt'])
    console.log('📝 Step 2.2: Adding index on Waves.name...')
    await queryInterface.addIndex('Waves', ['name'])

    // Create WavePhotos table
    console.log('📝 Step 3: Creating WavePhotos table...')
    await queryInterface.createTable('WavePhotos', {
      waveUuid: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Waves',
          key: 'waveUuid'
        }
      },
      photoId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Photos',
          key: 'id'
        }
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    })

    // Add composite primary key for WavePhotos
    console.log('📝 Step 4: Adding composite primary key to WavePhotos...')
    await queryInterface.addConstraint('WavePhotos', {
      fields: ['waveUuid', 'photoId'],
      type: 'primary key',
      name: 'WavePhotos_pkey'
    })

    // Add indexes for WavePhotos
    console.log('📝 Step 5: Adding indexes to WavePhotos...')
    await queryInterface.addIndex('WavePhotos', ['waveUuid'])
    await queryInterface.addIndex('WavePhotos', ['photoId'])

    // Create WaveUsers table
    console.log('📝 Step 6: Creating WaveUsers table...')
    await queryInterface.createTable('WaveUsers', {
      waveUuid: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Waves',
          key: 'waveUuid'
        }
      },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    })

    // Add composite primary key for WaveUsers
    console.log('📝 Step 7: Adding composite primary key to WaveUsers...')
    await queryInterface.addConstraint('WaveUsers', {
      fields: ['waveUuid', 'uuid'],
      type: 'primary key',
      name: 'WaveUsers_pkey'
    })

    // Add indexes for WaveUsers
    console.log('📝 Step 8: Adding indexes to WaveUsers...')
    await queryInterface.addIndex('WaveUsers', ['waveUuid'])
    await queryInterface.addIndex('WaveUsers', ['uuid'])

    console.log('✅ Migration completed successfully: Waves, WavePhotos and WaveUsers tables created')
  },

  down: async (queryInterface) => {
    console.log('🔄 Starting rollback: Dropping Waves, WavePhotos and WaveUsers tables')

    // Drop WaveUsers table
    console.log('📝 Step 0: Dropping WaveUsers table...')
    await queryInterface.dropTable('WaveUsers')

    // Drop WavePhotos table
    console.log('📝 Step 1: Dropping WavePhotos table...')
    await queryInterface.dropTable('WavePhotos')

    // Drop Waves table
    console.log('📝 Step 2: Dropping Waves table...')
    await queryInterface.dropTable('Waves')

    console.log('✅ Rollback completed successfully')
  }
}
