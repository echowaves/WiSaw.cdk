import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'

const DEEP_LINK_BASE_URL = process.env.DEEP_LINK_BASE_URL ?? ''

interface WaveInvite {
  inviteToken: string
  waveUuid: string
  deepLink: string
  expiresAt: string | null
  maxUses: number | null
  useCount: number
  active: boolean
  createdAt: string
}

export default async function main (
  waveUuid: string,
  uuid: string
): Promise<WaveInvite[]> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  await _assertWaveRole(waveUuid, uuid, 'facilitator')

  const result = await psql.query(`
    SELECT "inviteToken", "waveUuid", "expiresAt", "maxUses", "useCount", "active", "createdAt"
    FROM "WaveInvites"
    WHERE "waveUuid" = $1
    ORDER BY "createdAt" DESC
  `, [waveUuid])

  await psql.clean()

  return result.rows.map((row: any) => ({
    ...row,
    deepLink: `${DEEP_LINK_BASE_URL}/wave/invite/${row.inviteToken}`
  }))
}
