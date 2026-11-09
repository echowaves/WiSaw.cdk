/* eslint-env node */
// ts-node's hook is load-bearing: generateSiteMap imports "../../psql" without an extension, which
// @babel/register and Node 24's type stripping cannot resolve. Header copied from
// tests/upload-seo-sidecar.js for the same reason.
require('ts-node/register/transpile-only')

const Module = require('module')
const path = require('path')
const { expect } = require('chai')
const { describe, it, after, afterEach } = require('mocha')

// lambda-fns/psql.ts imports the RDS CA bundle as a module; Node cannot parse .pem, so seed the
// require cache with a stub before anything pulls in psql.
const pemPath = path.resolve(__dirname, '../lambda-fns/certs/global-bundle.pem')
const pemWas = require.cache[pemPath]
if (pemWas === undefined) {
  const stub = new Module(pemPath, null)
  stub.filename = pemPath
  stub.loaded = true
  stub.exports = 'FAKE-CA-FOR-TESTS'
  require.cache[pemPath] = stub
}

after(() => {
  if (pemWas === undefined) delete require.cache[pemPath]
  else require.cache[pemPath] = pemWas
})

const { S3Client } = require('@aws-sdk/client-s3')

const {
  splitImageText,
  IMAGE_TITLE_MAX,
  IMAGE_CAPTION_MAX
} = require('../lambda-fns/utilities/seoSidecar.ts')
const { main } = require('../lambda-fns/lambdas/generateSiteMap/index.ts')
const psql = require('../lambda-fns/psql.ts').default

const ID = '35e99e0c-03a1-4f30-80d3-405bc1f3df35'

/** Publisher-shaped row: labels already aggregated by the sitemap's SQL. */
function mediaRow (overrides = {}) {
  return {
    id: ID,
    active: true,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    lastComment: null,
    labels: [],
    locality: null,
    district: null,
    region: null,
    video: false,
    ...overrides
  }
}

describe('splitImageText - tags label, comment captions', () => {
  it('gives the title the tag list and the caption the comment when both exist', () => {
    const pair = splitImageText(mediaRow({ lastComment: 'A heron at dawn', labels: ['Heron', 'Wetland'] }), 'photo')
    expect(pair.title).to.equal('Heron, Wetland')
    expect(pair.caption).to.equal('A heron at dawn')
    expect(pair.title).to.not.equal(pair.caption)
  })

  it('lets the two slots agree only when there is no comment to caption with', () => {
    const pair = splitImageText(mediaRow({ labels: ['Heron'] }), 'photo')
    expect(pair.title).to.equal('Heron')
    expect(pair.caption).to.equal(pair.title)
  })

  it('titles a tag-less commented photo from place and month instead of repeating the comment', () => {
    const pair = splitImageText(mediaRow({ lastComment: 'A heron at dawn', locality: 'Krasnodar' }), 'photo')
    expect(pair.caption).to.equal('A heron at dawn')
    expect(pair.title).to.not.equal(pair.caption)
    expect(pair.title).to.equal('WiSaw photo — Krasnodar, Nov 2026')
  })

  it('keeps the identity fallback title so an un-enriched page is still unique', () => {
    const pair = splitImageText(mediaRow(), 'photo')
    expect(pair.title).to.equal('WiSaw photo — Nov 2026')
    // With no comment there is nothing to caption, so both slots carry that one text.
    expect(pair.caption).to.equal(pair.title)
    // Place and month unknown: the id carries the title so the page stays unique among 21k.
    expect(splitImageText(mediaRow({ createdAt: null }), 'video').title).to.equal(`WiSaw video ${ID}`)
  })

  it('titles with the first three tags, the same list og:image:title publishes', () => {
    const labels = ['Heron', 'Wetland', 'Dawn', 'Birds', 'River']
    const pair = splitImageText(mediaRow({ labels, lastComment: 'A heron at dawn' }), 'photo')
    expect(pair.title).to.equal('Heron, Wetland, Dawn')
    expect(pair.caption).to.equal('A heron at dawn')
  })

  it('cuts a long tag list at a word inside the title cap and keeps the comment whole', () => {
    const labels = ['golden retriever puppy playing outdoors', 'sunny late summer afternoon in the backyard', 'chasing a tennis ball']
    const pair = splitImageText(mediaRow({ labels, lastComment: 'Our dog on her favourite afternoon.' }), 'photo')
    expect(pair.title.length).to.be.at.most(IMAGE_TITLE_MAX)
    expect(pair.title.endsWith('…'), pair.title).to.equal(true)
    expect(pair.caption).to.equal('Our dog on her favourite afternoon.')
  })

  it('caps the caption at the image-caption limit while the title stays inside its own', () => {
    const comment = 'long '.repeat(200).trim()
    const pair = splitImageText(mediaRow({ lastComment: comment }), 'photo')
    expect(pair.caption.length).to.equal(IMAGE_CAPTION_MAX)
    expect(pair.title.length).to.be.at.most(IMAGE_TITLE_MAX)
  })
})

describe('generateSiteMap - two texts in the emitted XML', () => {
  const originals = { connect: psql.connect, query: psql.query, clean: psql.clean }
  const sendWas = S3Client.prototype.send

  afterEach(() => {
    psql.connect = originals.connect
    psql.query = originals.query
    psql.clean = originals.clean
    S3Client.prototype.send = sendWas
  })

  /** Runs main() over fixed rows and returns the sitemap.xml body that would have been uploaded. */
  async function publish (rows) {
    const puts = []
    psql.connect = async () => {}
    psql.clean = async () => {}
    psql.query = async (sql) => ({ rows: /FROM "Photos"/i.test(sql) ? rows : [] })
    S3Client.prototype.send = async function (cmd) {
      puts.push(cmd)
      return {}
    }

    const ok = await main({})
    expect(ok, 'main() aborted before publishing').to.equal(true)

    const sitemapPut = puts.find((cmd) => cmd.input?.Key === 'sitemap.xml')
    expect(sitemapPut, 'no sitemap.xml PUT').to.not.equal(undefined)
    return String(sitemapPut.input.Body)
  }

  it('publishes distinct image title and caption for a commented photo', async () => {
    const xml = await publish([
      mediaRow({ id: 'a'.repeat(36), lastComment: 'A heron at dawn', labels: ['Heron', 'Wetland'] }),
      mediaRow({ id: 'b'.repeat(36), labels: ['Sunset'] })
    ])
    // One <url> block per photo; the library writes caption before title, so read a block rather
    // than assuming an order.
    const blocks = xml.split('<url>')
    const commented = blocks.find((block) => block.includes(`/photos/${'a'.repeat(36)}`))
    const plain = blocks.find((block) => block.includes(`/photos/${'b'.repeat(36)}`))

    expect(commented).to.include('<image:title>Heron, Wetland</image:title>')
    expect(commented).to.include('<image:caption>A heron at dawn</image:caption>')
    // The comment-less photo keeps the old equality - there is nothing else to say about it.
    expect(plain).to.include('<image:title>Sunset</image:title>')
    expect(plain).to.include('<image:caption>Sunset</image:caption>')
  })

  it('titles a video with its tags and describes it with the comment', async () => {
    const xml = await publish([
      mediaRow({ id: 'c'.repeat(36), video: true, lastComment: 'Shot at dawn', labels: ['Heron'] }),
      mediaRow({ id: 'd'.repeat(36), video: true, labels: ['Heron'] })
    ])
    const blocks = xml.split('<url>')
    const commented = blocks.find((block) => block.includes(`/videos/${'c'.repeat(36)}`))
    const plain = blocks.find((block) => block.includes(`/videos/${'d'.repeat(36)}`))

    expect(commented).to.include('<video:title>Heron</video:title>')
    expect(commented).to.include('<video:description>Shot at dawn</video:description>')
    // No comment means nothing to caption, so the description carries the title's text.
    expect(plain).to.include('<video:description>Heron</video:description>')
  })
})
