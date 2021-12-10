import * as moment from 'moment'
import sql from '../../sql'
import {plainToClass,} from 'class-transformer'
import Photo from '../../models/photo'

const AWS = require('aws-sdk')

// import AbuseReport from '../../models/abuseReport'

export default async function main(
  daysAgo: number,
  lat: number,
  lon: number,
  batch: number,
  whenToStop: string,
) {
  const currentDate = moment()
  const whenToStopDate = moment(whenToStop)

  const results =
  (await sql`
    SELECT
    *
    , ST_Distance(
  		  "location",
        ST_MakePoint(${lat}, ${lon})
      ) as distance
    , row_number()  OVER (ORDER BY "createdAt" DESC) + (100*${daysAgo}) as row_number

    FROM "Photos"
    WHERE
        "createdAt" >= ${currentDate.clone().subtract(daysAgo, 'days').format("YYYY-MM-DD HH:mm:ss.SSS")}
    AND "createdAt" <= ${currentDate.clone().add(1, 'days').subtract(daysAgo, 'days').format("YYYY-MM-DD HH:mm:ss.SSS")}
    AND active = true
    ORDER BY distance
    LIMIT 100
    OFFSET 0
  `)

  // console.log({results})
  const photos = results.map((photo: any) => plainToClass(Photo, photo))
  // .sort((a: Photo, b: Photo) => moment(b.createdAt).diff(moment(a.createdAt)))

  let noMoreData = false

  if(currentDate.clone().subtract(daysAgo, 'days').diff(whenToStopDate) < 0 ) {
    noMoreData = true
  }

  return {
    photos,
    batch,
    noMoreData,
  }
}
