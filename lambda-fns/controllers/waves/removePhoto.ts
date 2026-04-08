import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'

import { _updatePhotosCount } from './_updatePhotosCount'
import { _getWaveRole } from './_getWaveRole'
import { _isWaveFrozen } from './_isWaveFrozen'

export default async function main (
  waveUuid: string,
  photoId: string,
  uuid: string
): Promise<boolean> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(photoId, 'photoId')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  const role = await _getWaveRole(waveUuid, uuid)
  if (role === null) {
    await psql.clean()
    throw new Error('You are not a member of this wave')
  }

  // Fetch wave for freeze check
  const waveResult = await psql.query(`
    SELECT "splashDate", "freezeDate" FROM "Waves" WHERE "waveUuid" = $1
  `, [waveUuid])
  const wave = waveResult.rows[0]
  const isFrozen = _isWaveFrozen(wave)

  if (role === 'owner') {
    // Owner can always remove, even from frozen waves
  } else if (role === 'facilitator') {
    if (isFrozen) {
      await psql.clean()
      throw new Error('This wave is frozen and cannot be modified')
    }
  } else {
    // Contributor: can only remove own photo from unfrozen wave
    if (isFrozen) {
      await psql.clean()
      throw new Error('This wave is frozen and cannot be modified')
    }
    const photoResult = await psql.query(`
      SELECT "createdBy" FROM "WavePhotos"
      WHERE "waveUuid" = $1 AND "photoId" = $2
    `, [waveUuid, photoId])
    if (photoResult.rows.length === 0 || photoResult.rows[0].createdBy !== uuid) {
      await psql.clean()
      throw new Error('Insufficient permissions: you can only remove your own photos')
    }
  }

  await psql.query(`
    DELETE FROM "WavePhotos"
    WHERE "waveUuid" = $1 AND "photoId" = $2
  `, [
    waveUuid,
    photoId
  ])

  await _updatePhotosCount(waveUuid)
  await psql.clean()

  return true
}
