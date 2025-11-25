import { v4 as uuidv4 } from 'uuid'
import moment from 'moment'
import psql from '../../psql'
import { Wave } from '../../models/wave'
import { plainToClass } from 'class-transformer'

export default async function main (
  name: string,
  description: string,
  uuid: string
): Promise<Wave> {
  const waveUuid = uuidv4()
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
  const updatedAt = createdAt

  await psql.connect()
  const result = await psql.query(`
    INSERT INTO "Waves" (
      "id", "name", "description", "createdBy", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6
    ) RETURNING *
  `, [waveUuid, name, description, uuid, createdAt, updatedAt])
  await psql.clean()

  return plainToClass(Wave, result.rows[0])
}
