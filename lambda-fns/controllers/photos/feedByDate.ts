import moment from 'moment'
import psql from '../../psql'

import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'

async function _retrievePhotos (currentDate: moment.Moment, daysAgo: number, lat: number, lon: number): Promise<Photo[]> {
  const dateFrom = currentDate
    .clone()
    .subtract(daysAgo, 'days')
    .format('YYYY-MM-DD HH:mm:ss.SSS')
  const dateTo = currentDate
    .clone()
    .add(1, 'days')
    .subtract(daysAgo, 'days')
    .format('YYYY-MM-DD HH:mm:ss.SSS')
  const rowNumberOffset = 100 * daysAgo

  const query = `
    SELECT
    "Photos".*
    , ST_Distance(
        "location",
        ST_MakePoint($1, $2)
      ) as distance
    , row_number()  OVER (ORDER BY "Photos"."createdAt" DESC) + $3 as row_number
  
    FROM "Photos"
    WHERE
        "Photos"."createdAt" >= $4
    AND "Photos"."createdAt" <= $5
    AND active = true
  
    ORDER BY "Photos"."createdAt" DESC
    LIMIT 1000
    OFFSET 0
  `

  const results = (
    await psql.query(query, [lon, lat, rowNumberOffset, dateFrom, dateTo])
  ).rows
  // console.log({results})
  const photos = results.map((photo: any) => plainToClass(Photo, photo))
  // .sort((a: Photo, b: Photo) => moment(b.createdAt).diff(moment(a.createdAt)))

  return photos
}

export default async function main (
  daysAgo: number,
  lat: number,
  lon: number,
  batch: string,
  whenToStop: string
): Promise<{
    photos: Photo[]
    batch: string
    noMoreData: boolean
  }> {
  const currentDate = moment()
  const whenToStopDate = moment(whenToStop)

  await psql.connect()

  const arraySize = 15
  // call _retrievePhotos 10 times for 10 conscutive days in parallel
  const photos = (
    await Promise.all(
      [...Array(arraySize)].map(async (_, i) => await _retrievePhotos(currentDate, daysAgo * arraySize + i, lat, lon))
    )
  ).flat(1)

  await psql.clean()

  let noMoreData = false

  if (currentDate.clone().subtract(daysAgo * arraySize, 'days').diff(whenToStopDate) < 0) {
    noMoreData = true
  }

  return {
    photos,
    batch,
    noMoreData
  }
}
