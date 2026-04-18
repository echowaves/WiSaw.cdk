import { _isWaveDateFrozen } from './_isWaveDateFrozen'

export const FREEZE_MODES = ['AUTO', 'FROZEN', 'UNFROZEN'] as const
export type WaveFreezeMode = typeof FREEZE_MODES[number]

export const _isWaveFrozen = (wave: { splashDate: string, freezeDate: string, freezeMode?: string }): boolean => {
  if (wave.freezeMode === 'FROZEN') {
    return true
  }

  if (wave.freezeMode === 'UNFROZEN') {
    return false
  }

  return _isWaveDateFrozen(wave)
}

export const _assertValidFreezeMode = (freezeMode: string): void => {
  if (!FREEZE_MODES.includes(freezeMode as WaveFreezeMode)) {
    throw new Error('freezeMode must be one of AUTO, FROZEN, or UNFROZEN')
  }
}

export const _normalizeFreezeMode = (freezeMode: string | null | undefined): WaveFreezeMode | undefined => {
  if (freezeMode == null) {
    return undefined
  }

  _assertValidFreezeMode(freezeMode)
  return freezeMode as WaveFreezeMode
}
