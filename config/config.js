const devConfig = require('../.env.sample').config()
const testConfig = require('../.env.test').config()
const prodConfig = require('../.env.prod').config()

module.exports = {
  dev: {
    username: devConfig.username,
    password: devConfig.password,
    database: devConfig.database,
    host: devConfig.host,
    dialect: 'postgres',
  },
  test: {
    username: testConfig.username,
    password: testConfig.password,
    database: testConfig.database,
    host: testConfig.host,
    dialect: 'postgres',
  },
  prod: {
    username: prodConfig.username,
    password: prodConfig.password,
    database: prodConfig.database,
    host: prodConfig.host,
    dialect: 'postgres',
  },
}
