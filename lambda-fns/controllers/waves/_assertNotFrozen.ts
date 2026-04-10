import { _isWaveFrozen } from './_isWaveFrozen'

export const _assertNotFrozen = (wave: { splashDate: string, freezeDate: string }): void => {
  if (_isWaveFrozen(wave)) {
    throw new Error('This wave is frozen and cannot be modified')
  }
}
