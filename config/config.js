import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const devConfig = require('../.env.sample').config()
const testConfig = require('../.env.test').config()
const prodConfig = require('../.env.prod').config()

export const dev = {
  username: devConfig.username,
  password: devConfig.password,
  database: devConfig.database,
  host: devConfig.host,
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: true
    }
  }
}
export const test = {
  username: testConfig.username,
  password: testConfig.password,
  database: testConfig.database,
  host: testConfig.host,
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: true
    }
  }
}
export const prod = {
  username: prodConfig.username,
  password: prodConfig.password,
  database: prodConfig.database,
  host: prodConfig.host,
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: true
    }
  }
}
