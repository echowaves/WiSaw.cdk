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

  // First verify the wave exists and belongs to the user
  const waveResult = await psql.query(`
    SELECT "waveUuid" FROM "Waves"
    WHERE "waveUuid" = $1 AND "createdBy" = $2
  `, [waveUuid, uuid])

  if (waveResult.rows.length === 0) {
    await psql.clean()
    throw new Error('Wave not found or you do not have permission to delete it')
  }

  // Delete from WavePhotos (also handled by CASCADE, but explicit for safety)
  await psql.query(`
    DELETE FROM "WavePhotos"
    WHERE "waveUuid" = $1
  `, [waveUuid])

  // Delete from WaveUsers (also handled by CASCADE, but explicit for safety)
  await psql.query(`
    DELETE FROM "WaveUsers"
    WHERE "waveUuid" = $1
  `, [waveUuid])

  // Delete the wave itself
  await psql.query(`
    DELETE FROM "Waves"
    WHERE "waveUuid" = $1 AND "createdBy" = $2
  `, [waveUuid, uuid])

  await psql.clean()

  return true
}
