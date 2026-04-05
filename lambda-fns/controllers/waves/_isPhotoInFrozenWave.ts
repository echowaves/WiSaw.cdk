import psql from '../../psql'

export const _isPhotoInFrozenWave = async (photoId: string): Promise<boolean> => {
  const result = await psql.query(`
    SELECT 1 FROM "WavePhotos" wp
    JOIN "Waves" w ON w."waveUuid" = wp."waveUuid"
    WHERE wp."photoId" = $1
      AND (w."frozen" = true
        OR (w."endDate" IS NOT NULL AND NOW() > w."endDate"))
  `, [photoId])

  return result.rows.length > 0
}
