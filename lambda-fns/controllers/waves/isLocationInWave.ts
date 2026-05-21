import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'
import { _isLocationInRadius } from './_isLocationInRadius'

export default async function main (
  lat: number,
  lon: number,
  waveUuid: string,
  uuid: string
): Promise<boolean> {
  assertValidUuid(uuid, 'uuid')
  assertValidUuid(waveUuid, 'waveUuid')

  await psql.connect()
  await _assertWaveRole(waveUuid, uuid, 'contributor')
  const within = await _isLocationInRadius(lat, lon, waveUuid)
  await psql.clean()

  return within
}
