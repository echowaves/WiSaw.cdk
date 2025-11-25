import psql from '../../psql'

export default async function main (
  waveUuid: string,
  uuid: string
): Promise<boolean> {
  await psql.connect()
  await psql.query(`
    DELETE FROM "Waves"
    WHERE "id" = $1 AND "createdBy" = $2
  `, [waveUuid, uuid])
  await psql.clean()

  return true
}
