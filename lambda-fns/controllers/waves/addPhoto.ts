import moment from 'moment'

import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _updatePhotosCount } from './_updatePhotosCount'
import { _assertNotBanned } from './_assertNotBanned'
import { _getWaveRole } from './_getWaveRole'
import { _assertNotFrozen } from './_assertNotFrozen'
import { _assertGeoBounds } from './_assertGeoBounds'
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

  await _assertNotBanned(waveUuid, uuid)

  const role = await _getWaveRole(waveUuid, uuid)
  if (role === null) {
    await psql.clean()
    throw new Error('You are not a member of this wave')
  }

  // Fetch wave for freeze/geo checks
  const waveResult = await psql.query(`
    SELECT "splashDate", "freezeDate", "freezeMode", "location", "radius" FROM "Waves" WHERE "waveUuid" = $1
  `, [waveUuid])
  const wave = waveResult.rows[0]

  _assertNotFrozen(wave)

  await _assertGeoBounds(waveUuid, photoId)

  // Check if photo is already in another wave
  const existing = (await psql.query(`
    SELECT "waveUuid" FROM "WavePhotos" WHERE "photoId" = $1 LIMIT 1
  `, [photoId])).rows[0]

  if (existing != null && existing.waveUuid !== waveUuid) {
    // Check if source wave is frozen — block move unless owner of source wave
    const sourceWaveResult = await psql.query(`
      SELECT "splashDate", "freezeDate", "freezeMode" FROM "Waves" WHERE "waveUuid" = $1
    `, [existing.waveUuid])
    const sourceWave = sourceWaveResult.rows[0]

    if (sourceWave != null && _isWaveFrozen(sourceWave)) {
      const sourceRole = await _getWaveRole(existing.waveUuid, uuid)
      if (sourceRole !== 'owner') {
        await psql.clean()
        throw new Error('Photo is in a frozen wave and cannot be moved')
      }
    }

    await psql.query(`
      DELETE FROM "WavePhotos" WHERE "waveUuid" = $1 AND "photoId" = $2
    `, [existing.waveUuid, photoId])
    await _updatePhotosCount(existing.waveUuid)
  }

  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss')
  const updatedAt = createdAt

  await psql.query(`
    INSERT INTO "WavePhotos" (
      "waveUuid",
      "photoId",
      "createdBy",
      "createdAt",
      "updatedAt"
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5
    ) ON CONFLICT ("waveUuid", "photoId") DO NOTHING
  `, [
    waveUuid,
    photoId,
    uuid,
    createdAt,
    updatedAt
  ])
  await _updatePhotosCount(waveUuid)
  await psql.clean()

  return true
}
