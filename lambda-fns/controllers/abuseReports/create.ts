import * as moment from 'moment'

import sql from '../../sql'

import AbuseReport from '../../models/abuseReport'

export default async function main(abuseReport: AbuseReport) {
  abuseReport.createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  abuseReport.updatedAt = abuseReport.createdAt
  try {
    return (await sql`
                      insert into "AbuseReports"
                      (
                          "photoId",
                          "uuid",
                          "createdAt",
                          "updatedAt"
                      ) values (
                        ${abuseReport.photoId},
                        ${abuseReport.uuid},
                        ${abuseReport.createdAt},
                        ${abuseReport.updatedAt}
                      )
                      returning *
                      `)[0]
    } catch (error) {
        console.log({error})
        return null
    }
}
