import { validate as uuidValidate } from 'uuid'
import psql from '../../psql'

export default async function main (
  waveUuid: string,
  uuid: string
): Promise<boolean> {
  if (!uuidValidate(waveUuid)) {
    throw new Error('Wrong UUID format for waveUuid')
  }
  if (!uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }

  await psql.connect()
  await psql.query(`
    DELETE FROM "Waves"
    WHERE "waveUuid" = $1 AND "createdBy" = $2
  `, [waveUuid, uuid])
  await psql.clean()

  return true
}
