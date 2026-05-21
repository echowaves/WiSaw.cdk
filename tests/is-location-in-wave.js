require('ts-node/register/transpile-only')

const { expect } = require('chai')
const { describe, it } = require('mocha')

const { assertValidUuid } = require('../lambda-fns/utilities/assertValidUuid.ts')

describe('isLocationInWave: input validation', () => {
  it('rejects invalid uuid format', () => {
    expect(() => assertValidUuid('not-a-uuid', 'uuid')).to.throw()
  })

  it('rejects invalid waveUuid format', () => {
    expect(() => assertValidUuid('not-a-uuid', 'waveUuid')).to.throw()
  })

  it('accepts valid uuid format', () => {
    expect(() => assertValidUuid('550e8400-e29b-41d4-a716-446655440000', 'uuid')).to.not.throw()
  })
})
