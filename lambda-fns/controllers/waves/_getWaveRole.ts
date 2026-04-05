import psql from '../../psql'

export const _getWaveRole = async (waveUuid: string, uuid: string): Promise<string | null> => {
  const result = await psql.query(`
    SELECT "role" FROM "WaveUsers"
    WHERE "waveUuid" = $1 AND "uuid" = $2
  `, [waveUuid, uuid])

  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0].role
}
