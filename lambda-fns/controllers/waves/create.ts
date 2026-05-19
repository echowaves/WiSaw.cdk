import { v4 as uuidv4 } from 'uuid'
import moment from 'moment'
import psql from '../../psql'
import { Wave } from '../../models/wave'
import { plainToClass } from 'class-transformer'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertHasSecret } from './_assertHasSecret'

export default async function main (
  name: string,
  description: string,
  uuid: string,
  lat?: number,
  lon?: number,
  radius?: number,
  groupingLevel?: string,
  splashDate?: string,
  freezeDate?: string
): Promise<Wave> {
  assertValidUuid(uuid, 'uuid')
  if (name.trim().length === 0) {
    throw new Error('Unable to save empty wave name.')
  }

  const waveUuid = uuidv4()
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
  const updatedAt = createdAt

  const effectiveSplashDate = splashDate ?? createdAt
  const effectiveFreezeDate = freezeDate ?? moment().add(30, 'days').format('YYYY-MM-DD HH:mm:ss.SSS')

  if (new Date(effectiveFreezeDate) <= new Date(effectiveSplashDate)) {
    throw new Error('freezeDate must be after splashDate')
  }

  await psql.connect()
  await _assertHasSecret(uuid)

  // Build query based on whether location is provided
  const hasLocation = lat !== undefined && lon !== undefined
  const query = hasLocation
    ? `
      INSERT INTO "Waves" (
        "waveUuid", "name", "description", "createdBy", "location", "radius", "groupingLevel", "splashDate", "freezeDate", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, ST_MakePoint($5, $6), $7, $8, $9, $10, $11, $12
      ) RETURNING *
    `
    : `
      INSERT INTO "Waves" (
        "waveUuid", "name", "description", "createdBy", "radius", "groupingLevel", "splashDate", "freezeDate", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING *
    `

  const params = hasLocation
    ? [waveUuid, name, description, uuid, lon, lat, radius ?? 50, groupingLevel ?? 'CITY', effectiveSplashDate, effectiveFreezeDate, createdAt, updatedAt]
    : [waveUuid, name, description, uuid, radius ?? 50, groupingLevel ?? 'CITY', effectiveSplashDate, effectiveFreezeDate, createdAt, updatedAt]

  const result = await psql.query(query, params)

  await psql.query(`
    INSERT INTO "WaveUsers" (
      "waveUuid", "uuid", "role", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5
    )
  `, [waveUuid, uuid, 'owner', createdAt, updatedAt])

  await psql.clean()

  return plainToClass(Wave, result.rows[0])
}
