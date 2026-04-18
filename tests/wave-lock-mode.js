require('ts-node/register/transpile-only')

const fs = require('fs')
const path = require('path')
const { expect } = require('chai')
const { describe, it } = require('mocha')

const { _isWaveFrozen } = require('../lambda-fns/controllers/waves/_isWaveFrozen.ts')
const { _isWaveDateFrozen } = require('../lambda-fns/controllers/waves/_isWaveDateFrozen.ts')

describe('wave freeze mode helpers', () => {
  it('uses date rules in AUTO mode', () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    const future = new Date(Date.now() + 60 * 1000).toISOString()

    expect(_isWaveDateFrozen({ splashDate: past, freezeDate: future })).to.equal(false)
    expect(_isWaveFrozen({ splashDate: past, freezeDate: future, freezeMode: 'AUTO' })).to.equal(false)
  })

  it('FROZEN overrides active date window', () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    const future = new Date(Date.now() + 60 * 1000).toISOString()

    expect(_isWaveFrozen({ splashDate: past, freezeDate: future, freezeMode: 'FROZEN' })).to.equal(true)
  })

  it('UNFROZEN overrides frozen-by-date state', () => {
    const future = new Date(Date.now() + 60 * 1000).toISOString()
    const fartherFuture = new Date(Date.now() + 120 * 1000).toISOString()

    expect(_isWaveDateFrozen({ splashDate: future, freezeDate: fartherFuture })).to.equal(true)
    expect(_isWaveFrozen({ splashDate: future, freezeDate: fartherFuture, freezeMode: 'UNFROZEN' })).to.equal(false)
  })
})

describe('updateWave owner-only freeze mode contract', () => {
  it('keeps owner guard and handles freezeMode persistence paths', () => {
    const updatePath = path.resolve(__dirname, '../lambda-fns/controllers/waves/update.ts')
    const source = fs.readFileSync(updatePath, 'utf8')

    expect(source).to.contain("await _assertWaveRole(waveUuid, uuid, 'owner')")
    expect(source).to.contain('freezeMode?: string')
    expect(source).to.contain('const normalizedFreezeMode = _normalizeFreezeMode(freezeMode)')
    expect(source).to.match(/setClauses\.push\(`"freezeMode" = \$\$\{paramIndex\+\+\}`\)/)
  })
})

describe('graphql schema freeze mode visibility', () => {
  it('exposes freezeMode on Wave type and updateWave mutation input', () => {
    const schemaPath = path.resolve(__dirname, '../graphql/schema.graphql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    expect(schema).to.contain('enum WaveFreezeMode')
    expect(schema).to.contain('freezeMode: WaveFreezeMode!')
    expect(schema).to.contain('freezeMode: WaveFreezeMode')
  })
})
