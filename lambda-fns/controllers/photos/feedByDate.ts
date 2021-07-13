import * as moment from 'moment'
import sql from '../../sql'

const AWS = require('aws-sdk')

// import AbuseReport from '../../models/abuseReport'

export default async function main(
  lat: number,
  lon: number,
  daysAgo: number,
  batch: string,
) {
  const currentDate = moment()

  const results = await sql
  `
  SELECT
  id
  , "uuid"
  , "location"
  , "createdAt"
  , "updatedAt"
  , "active"
  , "likes"
  , "commentsCount"
  , ST_Distance(
		"location",
    ST_MakePoint(${lat}, ${lon}) as distance
  FROM "Photos"
  WHERE
      "createdAt" >= ${currentDate.clone().subtract(daysAgo, 'days')}
  and "createdAt" <= ${currentDate.clone().add(1, 'days').subtract(daysAgo, 'days')}
  and active = true
  `
  console.log({results})
  return results
}
