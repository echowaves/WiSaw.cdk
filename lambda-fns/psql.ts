const ServerlessClient = require("serverless-postgres")
const { env } = process

const psql = new ServerlessClient({
  ...env,
  delayMs: 3000,
  maxConnections: 80,
  maxRetries: 3,
  ssl: true,
})

export default psql
