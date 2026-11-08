/* eslint-env node */
// Contract for the human gate in scripts/cleanup-s3.js: nothing is deleted until a person has
// seen the plan and agreed. Default answer is yes; "n" aborts; --yes skips the prompt.

const { expect } = require('chai')
const { describe, it, afterEach } = require('mocha')
const { PassThrough, Writable } = require('stream')

const { printDeletionPlan, confirmDeletions } = require('../scripts/cleanup-s3')

const PHOTO_A = '35e99e0c-03a1-4f30-80d3-405bc1f3df35'
const PHOTO_B = '7b3f2a10-1111-4222-8333-444455556666'

function captureLogs (fn) {
  const lines = []
  const original = console.log
  console.log = (...args) => { lines.push(args.map(String).join(' ')) }
  return Promise.resolve()
    .then(fn)
    .then((value) => ({ value, lines }))
    .finally(() => { console.log = original })
}

// process.stdin/stdout are accessor properties, so they must be replaced with defineProperty and
// the original descriptor put back afterwards.
function overrideProcess (name, value) {
  const saved = Object.getOwnPropertyDescriptor(process, name)
  Object.defineProperty(process, name, { value, configurable: true, writable: true })
  return () => {
    delete process[name]
    if (saved !== undefined) Object.defineProperty(process, name, saved)
  }
}

// Runs confirmDeletions against a fake terminal: stdin answers with `answer`, stdout is collected
// so the prompt text can be asserted.
function atATerminal (answer, run) {
  const input = new PassThrough()
  input.isTTY = true
  const written = []
  const output = new Writable({
    write (chunk, enc, cb) {
      written.push(chunk.toString())
      cb()
    }
  })
  output.isTTY = true
  const restoreIn = overrideProcess('stdin', input)
  const restoreOut = overrideProcess('stdout', output)

  const done = Promise.resolve()
    .then(run)
    .finally(() => {
      input.end()
      restoreIn()
      restoreOut()
    })
  setImmediate(() => {
    if (answer !== null) input.write(`${answer}\n`)
  })
  return done.then((value) => ({ value, prompt: written.join('') }))
}

describe('cleanup-s3 deletion gate', () => {
  const savedArgv = process.argv.slice()

  afterEach(() => {
    process.argv.length = 0
    process.argv.push(...savedArgv)
  })

  describe('printDeletionPlan', () => {
    it('says how many objects and how many photos are about to go', () => {
      const keys = [`${PHOTO_A}.webp`, `${PHOTO_A}-thumb.webp`, `${PHOTO_B}.json`]
      return captureLogs(() => printDeletionPlan(keys)).then(({ lines }) => {
        expect(lines[0]).to.contain('3 objects')
        expect(lines[0]).to.contain('2 photo(s)')
        expect(lines.join('\n')).to.contain(`${PHOTO_A}-thumb.webp`)
      })
    })

    it('samples the list instead of dumping 22k keys', () => {
      const keys = Array.from({ length: 55 }, (_, i) => `${PHOTO_A}-${i}.webp`)
      return captureLogs(() => printDeletionPlan(keys)).then(({ lines }) => {
        expect(lines).to.have.length(22) // header + 20 keys + overflow note
        expect(lines[lines.length - 1]).to.contain('and 35 more')
      })
    })
  })

  describe('confirmDeletions', () => {
    it('skips the prompt when --yes is given (automation)', () => {
      process.argv.push('--yes')
      return captureLogs(() => confirmDeletions([`${PHOTO_A}.webp`])).then(({ value, lines }) => {
        expect(value).to.equal(true)
        expect(lines.join('\n')).to.contain('--yes')
      })
    })

    it('proceeds with a warning when there is no terminal (old behaviour)', () => {
      const savedIsTTY = process.stdin.isTTY
      process.stdin.isTTY = false
      return captureLogs(() => confirmDeletions([`${PHOTO_A}.webp`]))
        .then(({ value, lines }) => {
          expect(value).to.equal(true)
          expect(lines.join('\n')).to.match(/not an interactive terminal/i)
        })
        .finally(() => { process.stdin.isTTY = savedIsTTY })
    })

    it('asks for confirmation naming how much is going', () => {
      const keys = [`${PHOTO_A}.webp`, `${PHOTO_B}-thumb.webp`]
      return atATerminal('y', () => confirmDeletions(keys)).then(({ value, prompt }) => {
        expect(prompt).to.contain('2 objects')
        expect(prompt).to.contain('[Y/n]')
        expect(value).to.equal(true)
      })
    })

    it('deletes on Enter — yes is the default answer', () => {
      return atATerminal('', () => confirmDeletions([`${PHOTO_A}.webp`])).then(({ value }) => {
        expect(value).to.equal(true)
      })
    })

    it('aborts on n, so nothing gets deleted', () => {
      return atATerminal('n', () => confirmDeletions([`${PHOTO_A}.webp`])).then(({ value }) => {
        expect(value).to.equal(false)
      })
    })

    it('aborts on anything that is not yes', () => {
      return atATerminal('maybe', () => confirmDeletions([`${PHOTO_A}.webp`])).then(({ value }) => {
        expect(value).to.equal(false)
      })
    })
  })
})
