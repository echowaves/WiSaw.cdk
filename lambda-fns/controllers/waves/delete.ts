import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'

export default async function main (
  waveUuid: string,
  uuid: string
): Promise<boolean> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()
  await _assertWaveRole(waveUuid, uuid, 'owner')

  // Delete from WavePhotos (also handled by CASCADE, but explicit for safety)
  await psql.query(`
    DELETE FROM "WavePhotos"
    WHERE "waveUuid" = $1
  `, [waveUuid])

  // Delete from WaveUsers (also handled by CASCADE, but explicit for safety)
  await psql.query(`
    DELETE FROM "WaveUsers"
    WHERE "waveUuid" = $1
  `, [waveUuid])

  // Delete the wave itself
  await psql.query(`
    DELETE FROM "Waves"
    WHERE "waveUuid" = $1
  `, [waveUuid])

  await psql.clean()

  return true
}
