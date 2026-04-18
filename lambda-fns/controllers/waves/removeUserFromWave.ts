import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'
import { _assertNotDateFrozen } from './_assertNotDateFrozen'
import { _getWaveRole } from './_getWaveRole'
import { _updatePhotosCount } from './_updatePhotosCount'

export default async function main (
  waveUuid: string,
  targetUuid: string,
  uuid: string
): Promise<boolean> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(targetUuid, 'targetUuid')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  // Only owner can remove users
  await _assertWaveRole(waveUuid, uuid, 'owner')

  // Wave must not be frozen
  const waveResult = await psql.query(`
    SELECT "splashDate", "freezeDate" FROM "Waves" WHERE "waveUuid" = $1
  `, [waveUuid])
  _assertNotDateFrozen(waveResult.rows[0])

  // Target must not be the owner
  const targetRole = await _getWaveRole(waveUuid, targetUuid)
  if (targetRole === null) {
    await psql.clean()
    throw new Error('Target user is not a member of this wave')
  }
  if (targetRole === 'owner') {
    await psql.clean()
    throw new Error('Cannot remove the wave owner')
  }

  // Delete target's photos from this wave
  await psql.query(`
    DELETE FROM "WavePhotos"
    WHERE "waveUuid" = $1 AND "createdBy" = $2
  `, [waveUuid, targetUuid])

  // Delete target's membership
  await psql.query(`
    DELETE FROM "WaveUsers"
    WHERE "waveUuid" = $1 AND "uuid" = $2
  `, [waveUuid, targetUuid])

  await _updatePhotosCount(waveUuid)

  await psql.clean()

  return true
}
