import dayjs, { type Dayjs } from 'dayjs'
import psql from '../../psql'
import { Wave } from '../../models/wave'
import { plainToClass } from 'class-transformer'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertNotBanned } from './_assertNotBanned'

export default async function main (
  waveUuid: string,
  uuid: string
): Promise<Wave> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  // Validate wave exists and is open
  const waveResult = await psql.query(`
    SELECT * FROM "Waves" WHERE "waveUuid" = $1
  `, [waveUuid])

  if (waveResult.rows.length === 0) {
    await psql.clean()
    throw new Error('Wave not found')
  }

  if (waveResult.rows[0].open !== true) {
    await psql.clean()
    throw new Error('This wave is not open for public joining')
  }

  await _assertNotBanned(waveUuid, uuid)

  // Insert user as contributor (ignore if already member)
  const now = dayjs().toISOString()
  await psql.query(`
    INSERT INTO "WaveUsers" ("waveUuid", "uuid", "role", "createdAt", "updatedAt")
    VALUES ($1, $2, 'contributor', $3, $4)
    ON CONFLICT ("waveUuid", "uuid") DO NOTHING
  `, [waveUuid, uuid, now, now])

  await psql.clean()

  return plainToClass(Wave, waveResult.rows[0])
}
