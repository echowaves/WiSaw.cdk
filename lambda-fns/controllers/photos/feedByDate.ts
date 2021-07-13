import * as moment from 'moment'
import sql from '../../sql'
import { plainToClass } from 'class-transformer';
import Photo from '../../models/photo'

const AWS = require('aws-sdk')

// import AbuseReport from '../../models/abuseReport'

export default async function main(
  lat: number,
  lon: number,
  daysAgo: number,
  batch: string,
) {
  console.log({lat, lon, daysAgo, batch})
  const currentDate = moment()

  const results = await sql
  `
  SELECT
  *
  , ${batch} as batch
  , ST_Distance(
		  "location",
      ST_MakePoint(${lat}, ${lon})
    ) as distance
  FROM "Photos"
  WHERE
      "createdAt" >= ${currentDate.clone().subtract(daysAgo, 'days').format("YYYY-MM-DD HH:mm:ss.SSS")}
  AND "createdAt" <= ${currentDate.clone().add(1, 'days').subtract(daysAgo, 'days').format("YYYY-MM-DD HH:mm:ss.SSS")}
  AND active = true
  ORDER BY distance
  LIMIT 100
  OFFSET 0
  `
  console.log({results})

  return results.map((photo: any) => plainToClass(Photo, photo))
}
