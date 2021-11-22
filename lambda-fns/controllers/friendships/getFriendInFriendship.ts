import * as moment from 'moment'
import sql from '../../sql'
import {plainToClass,} from 'class-transformer'
import Photo from '../../models/photo'

const AWS = require('aws-sdk')

// import AbuseReport from '../../models/abuseReport'

export default async function main(
  friendshipUuid: string,
  uuid: string
) {
  const currentDate = moment()

  const results =
  (await sql`
    SELECT
    *
    , ST_Distance(
  		  "location",
      ) as distance
    , row_number()  OVER (ORDER BY "createdAt" DESC) + (100) as row_number

    FROM "Photos"
    WHERE        
    active = true
    ORDER BY distance
    LIMIT 100
    OFFSET 0
  `)

  // console.log({results})
  const photos = results.map((photo: any) => plainToClass(Photo, photo))
  // .sort((a: Photo, b: Photo) => moment(b.createdAt).diff(moment(a.createdAt)))

  let noMoreData = false


  return {
    photos,
    noMoreData,
  }
}
