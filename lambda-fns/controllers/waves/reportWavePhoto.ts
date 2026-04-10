import moment from 'moment'
import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _getWaveRole } from './_getWaveRole'

export default async function main (
  waveUuid: string,
  photoId: string,
  uuid: string
): Promise<any> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(photoId, 'photoId')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  // Verify caller is a member of the wave
  const role = await _getWaveRole(waveUuid, uuid)
  if (role === null) {
    await psql.clean()
    throw new Error('You are not a member of this wave')
  }

  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss.SSS')

  const result = (
    await psql.query(`
      INSERT INTO "AbuseReports"
      (
        "photoId",
        "uuid",
        "waveUuid",
        "status",
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      )
      RETURNING *
    `, [photoId, uuid, waveUuid, 'pending', createdAt, createdAt])
  ).rows[0]

  await psql.clean()

  return result
}
