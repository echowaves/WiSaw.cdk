export const _isWaveDateFrozen = (wave: { splashDate: string, freezeDate: string }): boolean => {
  const now = new Date()

  if (new Date(wave.splashDate) > now) {
    return true
  }

  if (new Date(wave.freezeDate) < now) {
    return true
  }

  return false
}
