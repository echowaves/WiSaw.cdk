export const _isWaveFrozen = (wave: { frozen: boolean, endDate: string | null }): boolean => {
  if (wave.frozen) {
    return true
  }

  if (wave.endDate !== null && new Date(wave.endDate) < new Date()) {
    return true
  }

  return false
}
