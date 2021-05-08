import Sequelize from 'sequelize'
import { sequelize } from '../../../config/consts'

const AbuseReport = sequelize.define('AbuseReport', {
  id: {
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
    type: Sequelize.INTEGER,
  },
  photoId: {
    allowNull: false,
    type: Sequelize.INTEGER,
  },
  uuid: {
    type: Sequelize.UUID,
    allowNull: false,
  },
  createdAt: {
    allowNull: false,
    type: Sequelize.DATE,
  },
  updatedAt: {
    allowNull: false,
    type: Sequelize.DATE,
  },
})

// Adding a class level method

// Adding an instance level method

export default AbuseReport
