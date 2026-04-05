import crypto from 'crypto'
import moment from 'moment'
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
  uuid: string,
  expiresAt?: string,
  maxUses?: number
): Promise<WaveInvite> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  await _assertWaveRole(waveUuid, uuid, 'facilitator')

  // Reject if wave is open (open waves use direct join URL)
  const waveResult = await psql.query(`
    SELECT "open" FROM "Waves" WHERE "waveUuid" = $1
  `, [waveUuid])

  if (waveResult.rows.length === 0) {
    await psql.clean()
    throw new Error('Wave not found')
  }

  if (waveResult.rows[0].open === true) {
    await psql.clean()
    throw new Error('Cannot create invites for open waves — use the direct join URL instead')
  }

  const inviteToken = crypto.randomBytes(16).toString('hex')
  const now = moment().format('YYYY-MM-DD HH:mm:ss.SSS')

  await psql.query(`
    INSERT INTO "WaveInvites" (
      "inviteToken", "waveUuid", "createdBy", "expiresAt", "maxUses", "useCount", "active", "createdAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [inviteToken, waveUuid, uuid, expiresAt ?? null, maxUses ?? null, 0, true, now])

  await psql.clean()

  const deepLink = `${DEEP_LINK_BASE_URL}/wave/invite/${inviteToken}`

  return {
    inviteToken,
    waveUuid,
    deepLink,
    expiresAt: expiresAt ?? null,
    maxUses: maxUses ?? null,
    useCount: 0,
    active: true,
    createdAt: now
  }
}
