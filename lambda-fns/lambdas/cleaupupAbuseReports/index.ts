import psql from "../../psql"
import { traceLog } from '../../utilities/trace'

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any /*, cb: any*/) {
  const _traceStart = Date.now()
  traceLog('cleaupupAbuseReports:START')
  await psql.connect()

  try {
    await psql.query(`
    DELETE FROM "AbuseReports" where "createdAt" < NOW() - INTERVAL '7 days'
    `)
  } catch (err) {
    console.error("Unable to cleanup", { err })
    await psql.clean()
    traceLog('cleaupupAbuseReports:END', { duration: `${Date.now() - _traceStart}ms` })
    return false
  }
  await psql.clean()
  traceLog('cleaupupAbuseReports:END', { duration: `${Date.now() - _traceStart}ms` })
  return true
}
