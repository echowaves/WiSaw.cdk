import psql from '../../psql'
import { Wave } from '../../models/wave'
import Photo from '../../models/photo'
import { plainToClass } from 'class-transformer'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _isWaveFrozen } from './_isWaveFrozen'
import { _getWaveRole } from './_getWaveRole'

const DEEP_LINK_BASE_URL = process.env.DEEP_LINK_BASE_URL ?? ''

export default async function main (
  waveUuid: string,
  uuid: string
): Promise<Wave | null> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  const waveResult = await psql.query(
    'SELECT * FROM "Waves" WHERE "waveUuid" = $1',
    [waveUuid]
  )

  if (waveResult.rows.length === 0) {
    await psql.clean()
    return null
  }

  const row = waveResult.rows[0]

  const myRole = await _getWaveRole(waveUuid, uuid)

  const photosQuery = `
    SELECT "Photos".*
    FROM "WavePhotos"
    JOIN "Photos" ON "Photos"."id" = "WavePhotos"."photoId"
    WHERE "WavePhotos"."waveUuid" = $1
    AND "Photos"."active" = true
    ORDER BY "Photos"."updatedAt" DESC
    LIMIT 5
  `
  const photosResults = (await psql.query(photosQuery, [waveUuid])).rows
  const photos = photosResults.map((p: any, index: number) =>
    plainToClass(Photo, { ...p, row_number: index + 1 }).toJSON()
  )

  await psql.clean()

  const wave = plainToClass(Wave, row)
  wave.photos = photos
  wave.myRole = myRole as string
  wave.isFrozen = _isWaveFrozen(row)
  wave.joinUrl = row.open === true ? `${DEEP_LINK_BASE_URL}/wave/join/${wave.waveUuid}` : null

  return wave
}
