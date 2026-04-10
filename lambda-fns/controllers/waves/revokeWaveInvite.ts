import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'

export default async function main (
  inviteToken: string,
  uuid: string
): Promise<boolean> {
  assertValidUuid(uuid, 'uuid')

  if (inviteToken == null || inviteToken.trim().length === 0) {
    throw new Error('inviteToken is required')
  }

  await psql.connect()

  // Look up the invite to find its wave
  const inviteResult = await psql.query(`
    SELECT "waveUuid" FROM "WaveInvites" WHERE "inviteToken" = $1
  `, [inviteToken])

  if (inviteResult.rows.length === 0) {
    await psql.clean()
    throw new Error('Invite not found')
  }

  const waveUuid = inviteResult.rows[0].waveUuid

  // Validate caller is facilitator+ on the wave
  await _assertWaveRole(waveUuid, uuid, 'facilitator')

  await psql.query(`
    UPDATE "WaveInvites" SET "active" = false WHERE "inviteToken" = $1
  `, [inviteToken])

  await psql.clean()

  return true
}
