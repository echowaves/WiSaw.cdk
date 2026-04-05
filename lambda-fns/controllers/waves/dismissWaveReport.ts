import moment from 'moment'
import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'
import { _assertNotFrozen } from './_assertNotFrozen'

export default async function main (
  reportId: string,
  uuid: string
): Promise<boolean> {
  assertValidUuid(uuid, 'uuid')

  if (reportId == null || reportId.toString().trim().length === 0) {
    throw new Error('reportId is required')
  }

  await psql.connect()

  // Look up the report
  const reportResult = await psql.query(`
    SELECT "waveUuid" FROM "AbuseReports" WHERE "id" = $1
  `, [reportId])

  if (reportResult.rows.length === 0) {
    await psql.clean()
    throw new Error('Report not found')
  }

  const waveUuid = reportResult.rows[0].waveUuid
  if (waveUuid == null) {
    await psql.clean()
    throw new Error('This report is not associated with a wave')
  }

  // Caller must be facilitator+ on the wave
  await _assertWaveRole(waveUuid, uuid, 'facilitator')

  // Wave must not be frozen
  const waveResult = await psql.query(`
    SELECT "frozen", "endDate" FROM "Waves" WHERE "waveUuid" = $1
  `, [waveUuid])
  _assertNotFrozen(waveResult.rows[0])

  const now = moment().format('YYYY-MM-DD HH:mm:ss.SSS')

  await psql.query(`
    UPDATE "AbuseReports"
    SET "status" = 'dismissed', "reviewedBy" = $1, "reviewedAt" = $2, "updatedAt" = $3
    WHERE "id" = $4
  `, [uuid, now, now, reportId])

  await psql.clean()

  return true
}
