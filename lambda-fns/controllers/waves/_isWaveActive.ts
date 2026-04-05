import { _isWaveFrozen } from './_isWaveFrozen'

export const _isWaveActive = (wave: { frozen: boolean, endDate: string | null, startDate: string | null }): boolean => {
  if (_isWaveFrozen(wave)) {
    return false
  }

  if (wave.startDate !== null && new Date(wave.startDate) > new Date()) {
    return false
  }

  return true
}
