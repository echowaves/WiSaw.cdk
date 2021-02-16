const devConfig = require('../.env.sample').config()
const testConfig = require('../.env.test').config()
const prodConfig = require('../.env.prod').config()

module.exports = {
  dev: {
    username: devConfig.DB_USERNAME,
    password: devConfig.DB_PASSWORD,
    database: devConfig.DB_DATABASE,
    host: devConfig.DB_HOST,
    dialect: devConfig.DB_DIALECT,
    DATABASE_URL: devConfig.DATABASE_URL,
  },
  test: {
    username: testConfig.DB_USERNAME,
    password: testConfig.DB_PASSWORD,
    database: testConfig.DB_DATABASE,
    host: testConfig.DB_HOST,
    dialect: testConfig.DB_DIALECT,
    DATABASE_URL: testConfig.DATABASE_URL,
  },
  prod: {
    username: prodConfig.DB_USERNAME,
    password: prodConfig.DB_PASSWORD,
    database: prodConfig.DB_DATABASE,
    host: prodConfig.DB_HOST,
    dialect: prodConfig.DB_DIALECT,
    DATABASE_URL: prodConfig.DATABASE_URL,
  },
}
