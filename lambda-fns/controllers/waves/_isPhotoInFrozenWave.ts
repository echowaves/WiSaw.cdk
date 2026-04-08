import psql from '../../psql'

export const _isPhotoInFrozenWave = async (photoId: string): Promise<boolean> => {
  const result = await psql.query(`
    SELECT 1 FROM "WavePhotos" wp
    JOIN "Waves" w ON w."waveUuid" = wp."waveUuid"
    WHERE wp."photoId" = $1
      AND (NOW() < w."splashDate" OR NOW() > w."freezeDate")
  `, [photoId])

  return result.rows.length > 0
}
