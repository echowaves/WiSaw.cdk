import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _updatePhotosCount } from '../waves/_updatePhotosCount'

// import Photo from '../../models/photo'

export default async function main (photoId: string, uuid: string): Promise<string> {
  // const createdAt = dayjs().toISOString()
  assertValidUuid(photoId, 'photoId')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  // Check if photo is in a frozen wave, with role awareness for owner override
  const frozenCheck = await psql.query(`
    SELECT w."waveUuid", wu."role"
    FROM "WavePhotos" wp
    JOIN "Waves" w ON w."waveUuid" = wp."waveUuid"
    LEFT JOIN "WaveUsers" wu ON wu."waveUuid" = w."waveUuid" AND wu."uuid" = $2
    WHERE wp."photoId" = $1
      AND (
        w."freezeMode" = 'FROZEN'
        OR (
          w."freezeMode" = 'AUTO'
          AND (NOW() < w."splashDate" OR NOW() > w."freezeDate")
        )
      )
  `, [photoId, uuid])

  if (frozenCheck.rows.length > 0 && frozenCheck.rows[0].role !== 'owner') {
    await psql.clean()
    throw new Error('Cannot delete a photo that is in a frozen wave')
  }

  await psql.query(`
      UPDATE "Photos"
    SET "active" = false
    WHERE id = $1
    `, [photoId])

  // Update wave photosCount if photo was in a wave
  const waveResult = await psql.query(`
    SELECT "waveUuid" FROM "WavePhotos" WHERE "photoId" = $1 LIMIT 1
  `, [photoId])
  if (waveResult.rows.length > 0) {
    await _updatePhotosCount(waveResult.rows[0].waveUuid)
  }

  await psql.clean()

  return 'OK'
}
