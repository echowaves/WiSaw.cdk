import moment from 'moment'
import psql from '../../psql'

import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'

async function _retrievePhotos (currentDate: moment.Moment, daysAgo: number, lat: number, lon: number, waveUuid?: string): Promise<Photo[]> {
  let query = `
    SELECT
    "Photos".*
    , ST_Distance(
        "location",
        ST_MakePoint(${lon}, ${lat})
      ) as distance
    , row_number()  OVER (ORDER BY "Photos"."createdAt" DESC) + (100*${daysAgo}) as row_number
  
    FROM "Photos"
  `
  if (waveUuid !== undefined) {
    query += `
      JOIN "WavePhotos" ON "Photos".id = "WavePhotos"."photoId"
    `
  }

  query += `
    WHERE
        "Photos"."createdAt" >= '${currentDate
          .clone()
          .subtract(daysAgo, 'days')
          .format('YYYY-MM-DD HH:mm:ss.SSS')}'
    AND "Photos"."createdAt" <= '${currentDate
      .clone()
      .add(1, 'days')
      .subtract(daysAgo, 'days')
      .format('YYYY-MM-DD HH:mm:ss.SSS')}'
    AND active = true
  `

  if (waveUuid !== undefined) {
    query += `
      AND "WavePhotos"."waveUuid" = '${waveUuid}'
    `
  }

  query += `
    ORDER BY distance
    LIMIT 1000
    OFFSET 0
  `

  const results = (
    await psql.query(query)
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
  whenToStop: string,
  waveUuid?: string
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
      [...Array(arraySize)].map(async (_, i) => await _retrievePhotos(currentDate, daysAgo * arraySize + i, lat, lon, waveUuid))
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
