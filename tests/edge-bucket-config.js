/* eslint-env node */
// The edge media bucket is the one configuration fact Lambda@Edge cannot be given, so it is written
// into the injector's own code asset during synth and read back by a hand-written module in that
// folder. Both halves are pinned here: what synth writes, and what the reader does with it.

const { expect } = require('chai')
const { afterEach, describe, it } = require('mocha')
const fs = require('fs')
const path = require('path')

const {
  EDGE_BUCKET_FILE,
  edgeBucketModuleSource,
  writeEdgeBucketConfig
} = require('../lib/utilities/edgeMediaBucket.ts')

const FOLDER = path.join(__dirname, '..', 'lambda-fns', 'lambdas', 'injectMetaTagsLambdaFunction')
const GEN_PATH = path.join(FOLDER, EDGE_BUCKET_FILE)
const READER = path.join(FOLDER, 'bucket.js')

function freshReader () {
  delete require.cache[require.resolve(READER)]
  delete require.cache[GEN_PATH]
  return require(READER)
}

describe('edge media bucket - what synth writes', () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'edge-bucket-'))
  afterEach(() => {
    for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f))
  })

  it('writes a module the zip folder can require, naming the bucket exactly once', () => {
    const source = edgeBucketModuleSource('wisaw-img-staging')
    expect(source).to.contain("module.exports = { BUCKET: 'wisaw-img-staging' }")
    expect((source.match(/wisaw-img-staging/g) ?? []).length).to.equal(1)
  })

  it('round-trips the value through the generated module rather than pasting it raw', () => {
    // A bucket name cannot legally hold a quote, but a generated file that breaks synth - or
    // silently changes the bucket - because a value was interpolated raw is not worth the risk.
    const awkward = "a'\\b"
    const target = writeEdgeBucketConfig(dir, awkward)
    delete require.cache[target]
    expect(require(target).BUCKET).to.equal(awkward)
  })

  it('writes the file, and does not rewrite it when nothing changed', () => {
    const target = writeEdgeBucketConfig(dir, 'wisaw-img-test')
    expect(path.basename(target)).to.equal(EDGE_BUCKET_FILE)
    const first = fs.statSync(target).mtimeMs

    expect(writeEdgeBucketConfig(dir, 'wisaw-img-test')).to.equal(target)
    expect(fs.statSync(target).mtimeMs, 'unchanged content must not touch the asset').to.equal(first)

    writeEdgeBucketConfig(dir, 'wisaw-img-other')
    expect(fs.readFileSync(target, 'utf8')).to.contain('wisaw-img-other')
  })

  it('refuses to synthesise an edge with no bucket to name', () => {
    // Silence here is a distribution that reads the production corpus for every environment.
    expect(() => writeEdgeBucketConfig(dir, '')).to.throw(/S3_BUCKET is missing/)
    expect(() => writeEdgeBucketConfig(dir, undefined)).to.throw(/S3_BUCKET is missing/)
  })
})

describe('edge media bucket - what the injector reads', () => {
  const envWas = process.env.WISAW_IMG_BUCKET
  const genWas = fs.existsSync(GEN_PATH) ? fs.readFileSync(GEN_PATH) : null

  afterEach(() => {
    if (envWas === undefined) delete process.env.WISAW_IMG_BUCKET
    else process.env.WISAW_IMG_BUCKET = envWas
    if (genWas === null) fs.rmSync(GEN_PATH, { force: true })
    else fs.writeFileSync(GEN_PATH, genWas)
  })

  it('prefers an explicit WISAW_IMG_BUCKET, which is how a test or a local run picks its bucket', () => {
    process.env.WISAW_IMG_BUCKET = 'wisaw-img-from-env'
    expect(freshReader().imgBucket()).to.equal('wisaw-img-from-env')
  })

  it('reads the constant synth wrote when nothing is set in the environment', () => {
    delete process.env.WISAW_IMG_BUCKET
    fs.writeFileSync(GEN_PATH, edgeBucketModuleSource('wisaw-img-synthesized'))
    expect(freshReader().imgBucket()).to.equal('wisaw-img-synthesized')
  })

  it('falls back to the production name and says so when neither exists', () => {
    delete process.env.WISAW_IMG_BUCKET
    fs.rmSync(GEN_PATH, { force: true })

    const reader = freshReader()
    reader.resetFallbackWarning()
    const warns = []
    const warnWas = console.warn
    console.warn = (...args) => warns.push(args.join(' '))
    try {
      expect(reader.imgBucket()).to.equal(reader.FALLBACK_BUCKET)
    } finally {
      console.warn = warnWas
    }
    expect(warns.join('\n')).to.contain('WISAW_IMG_BUCKET')
  })
})
