import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'

export default async function main (
  waveUuid: string,
  uuid: string
): Promise<any[]> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  await _assertWaveRole(waveUuid, uuid, 'facilitator')

  const result = await psql.query(`
    SELECT * FROM "AbuseReports"
    WHERE "waveUuid" = $1
    ORDER BY "createdAt" DESC
  `, [waveUuid])

  await psql.clean()

  return result.rows
}
