import psql from '../../psql'

export const _getWaveInfo = async (photoId: string): Promise<{ waveName: string | null, waveUuid: string | null }> => {
  await psql.connect()
  const result =
  (await psql.query(`
                    SELECT w."name" AS "waveName", w."waveUuid"
                    FROM "WavePhotos" wp
                    JOIN "Waves" w ON w."waveUuid" = wp."waveUuid"
                    WHERE wp."photoId" = $1
                    LIMIT 1
                    `, [photoId])
  ).rows[0]
  await psql.clean()

  return {
    waveName: result?.waveName ?? null,
    waveUuid: result?.waveUuid ?? null
  }
}
