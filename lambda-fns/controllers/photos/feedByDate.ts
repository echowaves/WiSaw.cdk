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
  batch: number,
  whenToStop: string,
) {
  console.log({lat, lon, daysAgo, batch, whenToStop})
  const currentDate = moment()
  const whenToStopDate = moment(whenToStop)

  const results =
  (await sql`
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
  `)

  console.log({results})
  // console.log({slicedRezults: results.slice(0, -2) })// remove 2 last elements
  const photos = results.map((photo: any) => plainToClass(Photo, photo))
  let noMoreData = false

  // if(photos.length === 0) {
  //   const min = (await sql`select min("createdAt") from "Photos"`)[0].min
  //   console.log({min})

  console.log({diff: currentDate.clone().add(1, 'days').subtract(daysAgo, 'days').diff(whenToStopDate)})
  if(currentDate.clone().add(1, 'days').subtract(daysAgo, 'days').diff(whenToStopDate) < 0 ) {
    noMoreData = true
  }
  // }

  return {
    photos,
    batch,
    noMoreData,
  }
}
