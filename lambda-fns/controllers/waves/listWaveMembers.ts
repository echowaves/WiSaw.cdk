import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'

interface WaveMember {
  uuid: string
  nickName: string | null
  role: string
  createdAt: string
}

export default async function main (
  waveUuid: string,
  uuid: string
): Promise<WaveMember[]> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  await _assertWaveRole(waveUuid, uuid, 'facilitator')

  const result = await psql.query(`
    SELECT wu."uuid", s."nickName", wu."role", wu."createdAt"
    FROM "WaveUsers" wu
    LEFT JOIN "Secrets" s ON wu."uuid" = s."uuid"
    WHERE wu."waveUuid" = $1
    ORDER BY wu."createdAt" ASC
  `, [waveUuid])

  await psql.clean()

  return result.rows
}
