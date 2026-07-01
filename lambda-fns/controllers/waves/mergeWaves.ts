import dayjs, { type Dayjs } from 'dayjs'
import psql from '../../psql'
import { Wave } from '../../models/wave'
import { plainToClass } from 'class-transformer'
import { _updatePhotosCount } from './_updatePhotosCount'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'

export default async function main (
  targetWaveUuid: string,
  sourceWaveUuids: string[],
  uuid: string,
  name?: string,
  description?: string
): Promise<Wave> {
  assertValidUuid(targetWaveUuid, 'targetWaveUuid')
  assertValidUuid(uuid, 'uuid')
  if (sourceWaveUuids.length === 0) {
    throw new Error('At least one source wave must be provided')
  }

  // Validate all UUIDs upfront and check for self-merge / duplicates
  const sourceUuidSet = new Set<string>()
  for (const sourceWaveUuid of sourceWaveUuids) {
    assertValidUuid(sourceWaveUuid, 'sourceWaveUuid')
    if (sourceWaveUuid === targetWaveUuid) {
      throw new Error('Cannot merge a wave into itself')
    }
    if (sourceUuidSet.has(sourceWaveUuid)) {
      throw new Error(`Duplicate source wave UUID: ${sourceWaveUuid}`)
    }
    sourceUuidSet.add(sourceWaveUuid)
  }

  await psql.connect()

  // Verify user is owner of target wave
  await _assertWaveRole(targetWaveUuid, uuid, 'owner')

  // Owner of all waves can merge regardless of freeze status
  // Check ownership of every source wave
  for (const sourceWaveUuid of sourceWaveUuids) {
    await _assertWaveRole(sourceWaveUuid, uuid, 'owner')
  }

  // Move photos from each source into target, merge users, delete source
  for (const sourceWaveUuid of sourceWaveUuids) {
    // Move all photos from source to target (preserves original createdBy)
    await psql.query(`
      UPDATE "WavePhotos"
      SET "waveUuid" = $1
      WHERE "waveUuid" = $2
    `, [targetWaveUuid, sourceWaveUuid])

    // Merge WaveUsers from source into target (skip duplicates)
    const now = dayjs().toISOString()
    await psql.query(`
      INSERT INTO "WaveUsers" ("waveUuid", "uuid", "role", "createdAt", "updatedAt")
      SELECT $1, "uuid", "role", $3, $4
      FROM "WaveUsers"
      WHERE "waveUuid" = $2
      ON CONFLICT ("waveUuid", "uuid") DO NOTHING
    `, [targetWaveUuid, sourceWaveUuid, now, now])

    // Delete source wave's users (WavePhotos already moved above)
    await psql.query(`
      DELETE FROM "WaveUsers"
      WHERE "waveUuid" = $1
    `, [sourceWaveUuid])

    // Delete source wave
    await psql.query(`
      DELETE FROM "Waves"
      WHERE "waveUuid" = $1
    `, [sourceWaveUuid])
  }

  // Optionally update target name and description
  const now = dayjs().toISOString()
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
