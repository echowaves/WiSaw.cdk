import psql from '../../psql'

export const _assertNotBanned = async (waveUuid: string, uuid: string): Promise<void> => {
  const result = await psql.query(`
    SELECT 1 FROM "WaveBans"
    WHERE "waveUuid" = $1 AND "uuid" = $2
  `, [waveUuid, uuid])

  if (result.rows.length > 0) {
    throw new Error('You are banned from this wave')
  }
}
