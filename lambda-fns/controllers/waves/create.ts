import { v4 as uuidv4, validate as uuidValidate } from 'uuid'
import moment from 'moment'
import psql from '../../psql'
import { Wave } from '../../models/wave'
import { plainToClass } from 'class-transformer'

export default async function main (
  name: string,
  description: string,
  uuid: string
): Promise<Wave> {
  if (!uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }
  if (name.trim().length === 0) {
    throw new Error('Unable to save empty wave name.')
  }

  const waveUuid = uuidv4()
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
  const updatedAt = createdAt

  await psql.connect()
  const result = await psql.query(`
    INSERT INTO "Waves" (
      "waveUuid", "name", "description", "createdBy", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6
    ) RETURNING *
  `, [waveUuid, name, description, uuid, createdAt, updatedAt])

  await psql.query(`
    INSERT INTO "WaveUsers" (
      "waveUuid", "uuid", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4
    )
  `, [waveUuid, uuid, createdAt, updatedAt])

  await psql.clean()

  return plainToClass(Wave, result.rows[0])
}
