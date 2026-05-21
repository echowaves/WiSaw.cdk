import psql from '../../psql'

export const _isPhotoInFrozenWaveForUser = async (photoId: string, uuid: string): Promise<boolean> => {
  // Check if the user is owner or facilitator of any frozen wave containing this photo
  const result = await psql.query(`
    SELECT 1 FROM "WavePhotos" wp
    JOIN "Waves" w ON w."waveUuid" = wp."waveUuid"
    LEFT JOIN "WaveUsers" wu ON wu."waveUuid" = wp."waveUuid" AND wu."uuid" = $2
    WHERE wp."photoId" = $1
      AND (w."createdBy" = $2 OR wu."role" = 'facilitator')
      AND (
        w."freezeMode" = 'FROZEN'
        OR (
          w."freezeMode" = 'AUTO'
          AND (NOW() < w."splashDate" OR NOW() > w."freezeDate")
        )
      )
    LIMIT 1
  `, [photoId, uuid])

  if (result.rows.length > 0) {
    return false // Owner/facilitator can comment on their own frozen waves
  }

  const result2 = await psql.query(`
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

  return result2.rows.length > 0
}
