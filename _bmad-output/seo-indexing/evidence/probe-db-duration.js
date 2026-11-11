#!/usr/bin/env node
/* eslint-env node */

// Evidence tool for seo-indexing ticket 8: how many media rows would a duration backfill touch,
// and what does the stored shape look like today? Read-only — SELECT only.
//
//   node probe-db-duration.js prod
//
// Uses the same .env.<env> config and RDS CA bundle as scripts/publish-seo-sidecars.js.

const fs = require('fs')
const path = require('path')
const ServerlessClient = require('serverless-postgres')

const env = process.argv[2]
if (!['dev', 'test', 'staging', 'prod'].includes(env)) {
  console.error('usage: node probe-db-duration.js <dev|test|staging|prod>')
  process.exit(1)
}

const configModule = require(path.join(__dirname, '..', '..', '..', `.env.${env}`))
const cfg = typeof configModule.config === 'function' ? configModule.config() : configModule
const rdsCa = fs.readFileSync(path.join(__dirname, '../../../lambda-fns/certs/global-bundle.pem'), 'utf8')

const QUERY = `
  SELECT
    count(*)                                            AS rows_total,
    count(*) FILTER (WHERE "active")                     AS rows_active,
    count(*) FILTER (WHERE "video")                      AS videos_all,
    count(*) FILTER (WHERE "video" AND "active")         AS videos_active,
    count(*) FILTER (WHERE "video" AND "width" IS NULL)  AS videos_without_dimensions,
    max("createdAt")                                     AS newest_row,
    min("createdAt")                                     AS oldest_row
  FROM "Photos"
`

async function main () {
  const db = new ServerlessClient({
    ...cfg,
    user: cfg.username,
    delayMs: 1000,
    maxConnections: 5,
    maxRetries: 2,
    ssl: { ca: rdsCa, rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  })
  await db.connect()
  const { rows } = await db.query(QUERY)
  console.log(JSON.stringify(rows[0], null, 2))

  // Is the duration column already there? (It should not be until this ticket's migration runs.)
  const cols = await db.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'Photos'
    ORDER BY ordinal_position
  `)
  console.log('columns:', cols.rows.map((c) => `${c.column_name}:${c.data_type}`).join(', '))
  const hasDuration = cols.rows.some((c) => c.column_name.toLowerCase() === 'duration')
  console.log('Photos.duration exists:', hasDuration)

  await db.clean()
}

main().catch((err) => {
  console.error('probe failed:', err && err.message ? err.message : err)
  process.exitCode = 1
})
