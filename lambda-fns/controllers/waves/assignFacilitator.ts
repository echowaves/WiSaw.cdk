import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'
import { _assertHasSecret } from './_assertHasSecret'
import { _getWaveRole } from './_getWaveRole'

export default async function main (
  waveUuid: string,
  targetUuid: string,
  uuid: string
): Promise<boolean> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(targetUuid, 'targetUuid')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  // Only owner can assign facilitators
  await _assertWaveRole(waveUuid, uuid, 'owner')

  // Target must have a registered secret
  await _assertHasSecret(targetUuid)

  // Target must be a member of the wave
  const targetRole = await _getWaveRole(waveUuid, targetUuid)
  if (targetRole === null) {
    await psql.clean()
    throw new Error('Target user is not a member of this wave')
  }

  if (targetRole === 'owner') {
    await psql.clean()
    throw new Error('Cannot change the role of the wave owner')
  }

  await psql.query(`
    UPDATE "WaveUsers" SET "role" = 'facilitator'
    WHERE "waveUuid" = $1 AND "uuid" = $2
  `, [waveUuid, targetUuid])

  await psql.clean()

  return true
}
