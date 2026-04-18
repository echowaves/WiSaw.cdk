import { _isWaveDateFrozen } from './_isWaveDateFrozen'

export const _assertNotDateFrozen = (wave: { splashDate: string, freezeDate: string }): void => {
  if (_isWaveDateFrozen(wave)) {
    throw new Error('This wave is frozen and cannot be modified')
  }
}
