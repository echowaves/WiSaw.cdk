import dayjs, { type Dayjs } from 'dayjs'
import psql from '../../psql'
import { Wave } from '../../models/wave'
import { plainToClass } from 'class-transformer'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertNotBanned } from './_assertNotBanned'

export default async function main (
  inviteToken: string,
  uuid: string
): Promise<Wave> {
  assertValidUuid(uuid, 'uuid')

  if (inviteToken == null || inviteToken.trim().length === 0) {
    throw new Error('inviteToken is required')
  }

  await psql.connect()

  // Look up invite and validate
  const inviteResult = await psql.query(`
    SELECT "waveUuid", "active", "expiresAt", "maxUses", "useCount"
    FROM "WaveInvites"
    WHERE "inviteToken" = $1
  `, [inviteToken])

  if (inviteResult.rows.length === 0) {
    await psql.clean()
    throw new Error('Invite not found')
  }

  const invite = inviteResult.rows[0]

  if (invite.active !== true) {
    await psql.clean()
    throw new Error('This invite has been revoked')
  }

  if (invite.expiresAt != null && dayjs().isAfter(invite.expiresAt)) {
    await psql.clean()
    throw new Error('This invite has expired')
  }

  if (invite.maxUses != null && invite.useCount >= invite.maxUses) {
    await psql.clean()
    throw new Error('This invite has reached its maximum number of uses')
  }

  await _assertNotBanned(invite.waveUuid, uuid)

  // Insert user as contributor (ignore if already member)
  const now = dayjs().toISOString()
  await psql.query(`
    INSERT INTO "WaveUsers" ("waveUuid", "uuid", "role", "createdAt", "updatedAt")
    VALUES ($1, $2, 'contributor', $3, $4)
    ON CONFLICT ("waveUuid", "uuid") DO NOTHING
  `, [invite.waveUuid, uuid, now, now])

  // Increment use count
  await psql.query(`
    UPDATE "WaveInvites" SET "useCount" = "useCount" + 1
    WHERE "inviteToken" = $1
  `, [inviteToken])

  // Return the wave
  const waveResult = await psql.query(`
    SELECT * FROM "Waves" WHERE "waveUuid" = $1
  `, [invite.waveUuid])

  await psql.clean()

  return plainToClass(Wave, waveResult.rows[0])
}
