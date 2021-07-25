import * as moment from 'moment'

import sql from '../../sql'

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any, cb: any) {
  try {
      (await sql`
        DELETE FROM "AbuseReports" where "createdAt" < NOW() - INTERVAL \'7 days\'
      `)

  } catch (err) {
    console.log('Unable to cleanup', {err})
    return false
  }
  return true
}
