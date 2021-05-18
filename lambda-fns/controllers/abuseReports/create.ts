const moment = require('moment')

// boilerplate for connecting to DB
const postgres = require('postgres')
const {env} =  process
const sql = postgres({ ...env })

import AbuseReport from '../../models/abuseReport'

export default async function main(abuseReport: AbuseReport) {
  const { uuid, photoId } = abuseReport
  abuseReport.createdAt = moment()
  abuseReport.updatedAt = abuseReport.createdAt

    try {
        return await sql`
                          insert into AbuseReports ${
                            sql(abuseReport)
                          }
                          returning *
                          `
    } catch (err) {
        console.log('Postgres error: ', err)
        return null
    }
}
