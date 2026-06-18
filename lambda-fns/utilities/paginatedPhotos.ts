import psql from '../psql'
import { plainToClass } from 'class-transformer'
import Photo from '../models/photo'

export interface PaginatedPhotosOptions {
  query: string
  params: unknown[]
  pageNumber: number
  batchSize?: number
  noMoreDataOverride?: boolean
  batch?: string
}

export interface PaginatedPhotosResult {
  photos: Photo[]
  batch: string
  noMoreData: boolean
  nextPage: number | null
}

export async function fetchPaginatedPhotos (
  options: PaginatedPhotosOptions
): Promise<PaginatedPhotosResult> {
  const batchSize = options.batchSize ?? 100
  const batch = options.batch ?? ''

  await psql.connect()
  try {
    const result = await psql.query(options.query, options.params)
    const photos = result.rows.map((row: any) => plainToClass(Photo, row))

    const noMoreData = options.noMoreDataOverride
      ? true
      : photos.length < batchSize

    return {
      photos,
      batch,
      noMoreData,
      nextPage: noMoreData ? null : options.pageNumber + 1
    }
  } finally {
    await psql.clean()
  }
}
