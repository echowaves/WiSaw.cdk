import { plainToClass } from 'class-transformer'

import psql from '../../psql'

import Photo from '../../models/photo'

export default async function main (
  waveUuid: string,
  pageNumber: number,
  batch: string
): Promise<{
    photos: Photo[]
    batch: string
    noMoreData: boolean
  }> {
  const limit = 20
  const offset = pageNumber * limit

  await psql.connect()

  const query = `
    SELECT P.*
    FROM "Photos" P
    JOIN "WavePhotos" WP ON P.id = WP."photoId"
    WHERE WP."waveUuid" = $1
    ORDER BY WP."createdAt" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const results = (await psql.query(query, [waveUuid])).rows
  await psql.clean()

  const photos = results.map((row: any) => plainToClass(Photo, row))
  const noMoreData = photos.length < limit

  return {
    photos,
    batch,
    noMoreData
  }
}
