/* eslint-env node */
/* global require, module */

const fs = require('fs')
const path = require('path')

const SAMPLE_ENV_PATH = '../.env.sample'
const rdsCa = fs.readFileSync(path.join(__dirname, '../lambda-fns/certs/global-bundle.pem'), 'utf8')

const loadEnvConfig = (envKey) => {
  const loadWithFallback = (loaderFn) => {
    try {
      return loaderFn().config()
    } catch (err) {
      return require(SAMPLE_ENV_PATH).config()
    }
  }

  switch (envKey) {
    case 'dev':
      return loadWithFallback(() => require('../.env.dev'))
    case 'staging':
      return loadWithFallback(() => require('../.env.staging'))
    case 'test':
      return loadWithFallback(() => require('../.env.test'))
    case 'prod':
      return loadWithFallback(() => require('../.env.prod'))
    default:
      return loadWithFallback(() => require(SAMPLE_ENV_PATH))
  }
}

const buildConfig = (envKey) => {
  const cfg = loadEnvConfig(envKey)
  return {
    username: cfg.username,
    password: cfg.password,
    database: cfg.database,
    host: cfg.host,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        ca: rdsCa,
        rejectUnauthorized: true
      }
    }
  }
}

module.exports = {
  dev: buildConfig('dev'),
  staging: buildConfig('staging'),
  test: buildConfig('test'),
  prod: buildConfig('prod')
}
