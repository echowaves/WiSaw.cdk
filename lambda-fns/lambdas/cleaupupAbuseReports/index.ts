// import * as moment from 'moment'

import psql from '../../psql'

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any/*, cb: any*/) {
  await psql.connect()

  try {
    await psql.query(`
    DELETE FROM "AbuseReports" where "createdAt" < NOW() - INTERVAL '7 days'
    `)
  } catch (err) {
    console.log('Unable to cleanup', {err,})
    await psql.clean()
    return false
  }
  await psql.clean()
  return true
}
