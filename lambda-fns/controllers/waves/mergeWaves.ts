import { validate as uuidValidate } from 'uuid'
import moment from 'moment'
import psql from '../../psql'
import { Wave } from '../../models/wave'
import { plainToClass } from 'class-transformer'
import { _updatePhotosCount } from './_updatePhotosCount'

export default async function main (
  targetWaveUuid: string,
  sourceWaveUuid: string,
  uuid: string,
  name?: string,
  description?: string
): Promise<Wave> {
  if (!uuidValidate(targetWaveUuid)) {
    throw new Error('Wrong UUID format for targetWaveUuid')
  }
  if (!uuidValidate(sourceWaveUuid)) {
    throw new Error('Wrong UUID format for sourceWaveUuid')
  }
  if (!uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }
  if (targetWaveUuid === sourceWaveUuid) {
    throw new Error('Cannot merge a wave into itself')
  }

  await psql.connect()

  // Verify user owns both waves
  const ownershipResult = await psql.query(`
    SELECT "waveUuid" FROM "Waves"
    WHERE "waveUuid" IN ($1, $2) AND "createdBy" = $3
  `, [targetWaveUuid, sourceWaveUuid, uuid])

  if (ownershipResult.rows.length < 2) {
    await psql.clean()
    throw new Error('Wave not found or you do not have permission to merge')
  }

  // Move all photos from source to target (preserves original createdBy)
  await psql.query(`
    UPDATE "WavePhotos"
    SET "waveUuid" = $1
    WHERE "waveUuid" = $2
  `, [targetWaveUuid, sourceWaveUuid])

  // Merge WaveUsers from source into target (skip duplicates)
  const now = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
  await psql.query(`
    INSERT INTO "WaveUsers" ("waveUuid", "uuid", "createdAt", "updatedAt")
    SELECT $1, "uuid", $3, $4
    FROM "WaveUsers"
    WHERE "waveUuid" = $2
    ON CONFLICT ("waveUuid", "uuid") DO NOTHING
  `, [targetWaveUuid, sourceWaveUuid, now, now])

  // Optionally update target name and description
  if (name != null && name.trim().length > 0) {
    await psql.query(`
      UPDATE "Waves" SET "name" = $1, "updatedAt" = $3
      WHERE "waveUuid" = $2
    `, [name, targetWaveUuid, now])
  }
  if (description != null) {
    await psql.query(`
      UPDATE "Waves" SET "description" = $1, "updatedAt" = $3
      WHERE "waveUuid" = $2
    `, [description, targetWaveUuid, now])
  }

  // Delete source wave (WavePhotos already moved, WaveUsers will cascade)
  await psql.query(`
    DELETE FROM "WaveUsers"
    WHERE "waveUuid" = $1
  `, [sourceWaveUuid])

  await psql.query(`
    DELETE FROM "Waves"
    WHERE "waveUuid" = $1
  `, [sourceWaveUuid])

  // Recalculate photosCount on target
  await _updatePhotosCount(targetWaveUuid)

  // Return the merged target wave
  const result = await psql.query(`
    SELECT * FROM "Waves"
    WHERE "waveUuid" = $1
  `, [targetWaveUuid])

  await psql.clean()

  return plainToClass(Wave, result.rows[0])
}
