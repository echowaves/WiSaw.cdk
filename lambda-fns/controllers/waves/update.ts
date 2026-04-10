import moment from 'moment'
import psql from '../../psql'
import { Wave } from '../../models/wave'
import { plainToClass } from 'class-transformer'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertWaveRole } from './_assertWaveRole'
import { _isWaveFrozen } from './_isWaveFrozen'

const DEEP_LINK_BASE_URL = process.env.DEEP_LINK_BASE_URL ?? ''

export default async function main (
  waveUuid: string,
  uuid: string,
  name?: string,
  description?: string,
  lat?: number,
  lon?: number,
  radius?: number,
  open?: boolean,
  splashDate?: string,
  freezeDate?: string
): Promise<Wave> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(uuid, 'uuid')
  if (name != null && name.trim().length === 0) {
    throw new Error('Unable to save empty wave name.')
  }

  await psql.connect()
  await _assertWaveRole(waveUuid, uuid, 'owner')

  // Fetch current wave state for freeze check
  const waveResult = await psql.query(`
    SELECT "splashDate", "freezeDate" FROM "Waves" WHERE "waveUuid" = $1
  `, [waveUuid])

  if (waveResult.rows.length === 0) {
    await psql.clean()
    throw new Error('Wave not found')
  }

  const currentWave = waveResult.rows[0]
  const isFrozen = _isWaveFrozen(currentWave)

  // When frozen, only allow freezeDate changes
  if (isFrozen) {
    const hasNonFreezeChanges = name != null || (description != null && description !== '') ||
      lat != null || lon != null || radius != null ||
      open != null || splashDate != null
    if (hasNonFreezeChanges) {
      await psql.clean()
      throw new Error('This wave is frozen. Only freeze date can be changed.')
    }
  }

  // Build dynamic SET clause
  const setClauses: string[] = []
  const params: any[] = []
  let paramIndex = 1

  if (name != null) {
    setClauses.push(`"name" = $${paramIndex++}`)
    params.push(name)
  }
  if (description != null) {
    setClauses.push(`"description" = $${paramIndex++}`)
    params.push(description === '' ? null : description)
  }
  if (lat != null && lon != null) {
    setClauses.push(`"location" = ST_MakePoint($${paramIndex}, $${paramIndex + 1})`)
    params.push(lon, lat)
    paramIndex += 2
    setClauses.push(`"radius" = $${paramIndex++}`)
    params.push(radius ?? 50)
  }
  if (open != null) {
    setClauses.push(`"open" = $${paramIndex++}`)
    params.push(open)
  }
  if (splashDate != null) {
    setClauses.push(`"splashDate" = $${paramIndex++}`)
    params.push(splashDate)
  }
  if (freezeDate != null) {
    setClauses.push(`"freezeDate" = $${paramIndex++}`)
    params.push(freezeDate)
  }

  const updatedAt = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
  setClauses.push(`"updatedAt" = $${paramIndex++}`)
  params.push(updatedAt)

  params.push(waveUuid)
  const query = `
    UPDATE "Waves"
    SET ${setClauses.join(', ')}
    WHERE "waveUuid" = $${paramIndex}
    RETURNING *
  `

  const result = await psql.query(query, params)
  await psql.clean()

  if (result.rows.length === 0) {
    throw new Error('Wave not found')
  }

  const row = result.rows[0]
  const wave = plainToClass(Wave, row)
  wave.isFrozen = _isWaveFrozen(row)
  wave.myRole = 'owner'
  wave.joinUrl = row.open === true ? `${DEEP_LINK_BASE_URL}/wave/join/${wave.waveUuid}` : null
  return wave
}
