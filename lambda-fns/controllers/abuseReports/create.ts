// import moment from 'moment'
const moment = require('moment')

// boilerplate for connecting to DB
const postgres = require('postgres')
const {env} =  process
const sql = postgres({ ...env })

import AbuseReport from '../../models/abuseReport'

export default async function main(abuseReport: AbuseReport) {
  const { uuid, photoId } = abuseReport
  let {  createdAt, updatedAt } = abuseReport

  if(!uuid) {
    console.log(`missing parameter uuid`)
    return null
  }
  if(!photoId) {
    console.log(`missing parameter photoId`)
    return null
  }

    createdAt = moment()
    updatedAt = abuseReport.createdAt

    try {
        const query = `INSERT INTO
                        abuseReporst (uuid,photoId,createdAt,updatedAt)
                        VALUES(:uuid,:photoId,:createdAt, :updatedAt)
                        RETURNING id`
        // abuseReport.id = await db.query(query, { uuid, photoId, createdAt, updatedAt })

        return abuseReport
    } catch (err) {
        console.log('Postgres error: ', err)
        return null
    }
}
