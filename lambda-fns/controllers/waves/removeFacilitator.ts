import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'
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

  // Only owner can remove facilitators
  await _assertWaveRole(waveUuid, uuid, 'owner')

  // Verify target is actually a facilitator
  const targetRole = await _getWaveRole(waveUuid, targetUuid)
  if (targetRole !== 'facilitator') {
    await psql.clean()
    throw new Error('Target user is not a facilitator')
  }

  await psql.query(`
    UPDATE "WaveUsers" SET "role" = 'contributor'
    WHERE "waveUuid" = $1 AND "uuid" = $2
  `, [waveUuid, targetUuid])

  await psql.clean()

  return true
}
