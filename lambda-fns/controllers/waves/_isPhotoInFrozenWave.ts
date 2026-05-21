import psql from '../../psql'

// Strict check — used by delete operations that require unfreezing first
export const _isPhotoInFrozenWave = async (photoId: string): Promise<boolean> => {
  const result = await psql.query(`
    SELECT 1 FROM "WavePhotos" wp
    JOIN "Waves" w ON w."waveUuid" = wp."waveUuid"
    WHERE wp."photoId" = $1
      AND (
        w."freezeMode" = 'FROZEN'
        OR (
          w."freezeMode" = 'AUTO'
          AND (NOW() < w."splashDate" OR NOW() > w."freezeDate")
        )
      )
  `, [photoId])

  return result.rows.length > 0
}
