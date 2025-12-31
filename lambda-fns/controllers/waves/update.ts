import { validate as uuidValidate } from 'uuid'
import moment from 'moment'
import psql from '../../psql'
import { Wave } from '../../models/wave'
import { plainToClass } from 'class-transformer'

export default async function main (
  waveUuid: string,
  uuid: string,
  name: string,
  description: string,
  lat?: number,
  lon?: number,
  radius?: number
): Promise<Wave> {
  if (!uuidValidate(waveUuid)) {
    throw new Error('Wrong UUID format for waveUuid')
  }
  if (!uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }
  if (name.trim().length === 0) {
    throw new Error('Unable to save empty wave name.')
  }

  const updatedAt = moment().format('YYYY-MM-DD HH:mm:ss.SSS')

  await psql.connect()

  // Build query based on whether location is provided
  const hasLocation = lat !== undefined && lon !== undefined
  const query = hasLocation
    ? `
      UPDATE "Waves" 
      SET "name" = $1, "description" = $2, "location" = ST_MakePoint($3, $4), "radius" = $5, "updatedAt" = $6
      WHERE "waveUuid" = $7 AND "createdBy" = $8
      RETURNING *
    `
    : `
      UPDATE "Waves" 
      SET "name" = $1, "description" = $2, "updatedAt" = $3
      WHERE "waveUuid" = $4 AND "createdBy" = $5
      RETURNING *
    `

  const params = hasLocation
    ? [name, description, lon, lat, radius ?? 50, updatedAt, waveUuid, uuid]
    : [name, description, updatedAt, waveUuid, uuid]

  const result = await psql.query(query, params)
  await psql.clean()

  if (result.rows.length === 0) {
    throw new Error('Wave not found or you do not have permission to update it')
  }

  return plainToClass(Wave, result.rows[0])
}
