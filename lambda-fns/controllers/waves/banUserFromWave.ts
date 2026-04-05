import moment from 'moment'
import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'
import { _assertNotFrozen } from './_assertNotFrozen'
import { _getWaveRole } from './_getWaveRole'
import { _updatePhotosCount } from './_updatePhotosCount'

export default async function main (
  waveUuid: string,
  targetUuid: string,
  uuid: string,
  reason?: string
): Promise<boolean> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(targetUuid, 'targetUuid')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  // Caller must be facilitator+
  const callerRole = await _assertWaveRole(waveUuid, uuid, 'facilitator')

  // Wave must not be frozen
  const waveResult = await psql.query(`
    SELECT "frozen", "endDate" FROM "Waves" WHERE "waveUuid" = $1
  `, [waveUuid])
  _assertNotFrozen(waveResult.rows[0])

  // Verify target is bannable based on caller's role
  const targetRole = await _getWaveRole(waveUuid, targetUuid)
  if (targetRole === null) {
    await psql.clean()
    throw new Error('Target user is not a member of this wave')
  }
  if (targetRole === 'owner') {
    await psql.clean()
    throw new Error('Cannot ban the wave owner')
  }
  if (callerRole === 'facilitator' && targetRole !== 'contributor') {
    await psql.clean()
    throw new Error('Facilitators can only ban contributors')
  }

  const now = moment().format('YYYY-MM-DD HH:mm:ss.SSS')

  // Transaction: delete photos, delete membership, insert ban
  await psql.query(`
    DELETE FROM "WavePhotos"
    WHERE "waveUuid" = $1 AND "createdBy" = $2
  `, [waveUuid, targetUuid])

  await psql.query(`
    DELETE FROM "WaveUsers"
    WHERE "waveUuid" = $1 AND "uuid" = $2
  `, [waveUuid, targetUuid])

  await psql.query(`
    INSERT INTO "WaveBans" ("waveUuid", "uuid", "bannedBy", "reason", "createdAt")
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT ("waveUuid", "uuid") DO NOTHING
  `, [waveUuid, targetUuid, uuid, reason ?? null, now])

  await _updatePhotosCount(waveUuid)

  await psql.clean()

  return true
}
