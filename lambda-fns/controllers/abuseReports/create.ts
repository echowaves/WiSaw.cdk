import * as moment from 'moment'

// boilerplate for connecting to DB
const postgres = require('postgres')
const {env} =  process
const sql = postgres({ ...env })

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
