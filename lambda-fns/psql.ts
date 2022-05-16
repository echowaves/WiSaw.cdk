const ServerlessClient = require('serverless-postgres')
const {env,} = process

const psql = new ServerlessClient({
  ...env,
  delayMs: 3000,
  maxConnections: 5,
  maxRetries: 3,
})

export default psql
