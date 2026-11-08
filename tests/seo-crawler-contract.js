/* eslint-env node */
const { expect } = require('chai')
const { describe, it } = require('mocha')
const fs = require('fs')
const path = require('path')

const {
  injectMetaTags,
  injectRouteTags,
  htmlResponse,
  renderNotFoundDocument
} = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils')
const { parseMediaUri, needsCanonicalRedirect } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/mediaUri')
const { buildSeoFields, monthYear } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoText')
// Both writers of the <id>.json sidecar plus the edge reader's guard. These objects are public, so
// a place NAME is fair content while a COORDINATE may never appear in one.
const { buildSeoSidecar, assertNoPreciseLocation } = require('../lambda-fns/utilities/seoSidecar.ts')
const { buildSidecar, QUERY } = require('../scripts/publish-seo-sidecars.js')
const { stripPreciseLocation } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/sidecar')

// Snapshot of what Googlebot actually receives for https://wisaw.com/ today (captured
// 2026-11-05). Tests run the real injector over the real shell instead of a hand-written
// approximation: the original canonical bug survived because the unit tests described a
// template nobody served. Refresh with: curl -sSL https://wisaw.com/ -o tests/fixtures/served-index.html
const SHELL = fs.readFileSync(path.join(__dirname, 'fixtures', 'served-index.html'), 'utf8')

const UUID = '35e99e0c-03a1-4f30-80d3-405bc1f3df35'
const UPPER_UUID = '35E99E0C-03A1-4F30-80D3-405BC1F3DF35'

function canonicalsOf (html) {
  return (html.match(/<link\b[^>]*\brel=(?:"canonical"|'canonical')[^>]*>/gi) || [])
}

function countOf (html, pattern) {
  return (html.match(pattern) || []).length
}

describe('mediaUri - one photo, one URL', () => {
  it('accepts the canonical lowercase form', () => {
    expect(parseMediaUri(`/photos/${UUID}`)).to.deep.equal({ kind: 'photos', id: UUID, valid: true })
  })

  it('lowercases an uppercase id instead of treating it as a new page', () => {
    const parsed = parseMediaUri(`/photos/${UPPER_UUID}`)
    expect(parsed.valid).to.equal(true)
    expect(parsed.id).to.equal(UUID)
  })

  it('drops the trailing slash and legacy /full and /thumb suffixes', () => {
    expect(parseMediaUri(`/photos/${UUID}/`).id).to.equal(UUID)
    expect(parseMediaUri(`/photos/${UUID}/full`).id).to.equal(UUID)
    expect(parseMediaUri(`/videos/${UUID}/thumb/`).id).to.equal(UUID)
  })

  it('rejects anything that is not a UUID so it can be answered with 404', () => {
    for (const uri of ['/photos/', '/photos/not-an-id', '/photos/a/b/c', `/photos/${UUID}/extra/deep`, '/videos/photos/x']) {
      expect(parseMediaUri(uri).valid, uri).to.equal(false)
    }
  })

  it('flags only the non-canonical spellings for redirect', () => {
    expect(needsCanonicalRedirect(`/photos/${UPPER_UUID}`)).to.equal(true)
    expect(needsCanonicalRedirect(`/photos/${UUID}/`)).to.equal(true)
    expect(needsCanonicalRedirect(`/photos/${UUID}`)).to.equal(false)
  })
})

describe('buildSeoFields - real text, never invented facts', () => {
  const sidecar = {
    caption: 'Golden retriever puppy on the beach at sunset',
    labels: ['Dog', 'dog', 'Pet', 'Beach', 'Sunset'],
    created: '2025-09-18T14:03:00.000Z',
    location: 'Coney Island, New York',
    width: '3024',
    height: '4032'
  }

  it('fits place and capture month into the title when the caption is short', () => {
    const seo = buildSeoFields({
      sidecar: { ...sidecar, caption: 'Golden retriever puppy', location: 'Coney Island' },
      entityLabel: 'photo',
      imageIdText: UUID
    })
    expect(seo.pageTitle).to.contain('Golden retriever puppy')
    expect(seo.pageTitle).to.contain('Coney Island')
    expect(seo.pageTitle).to.contain('Sep 2025')
    expect(seo.pageTitle).to.contain('WiSaw')
    expect(seo.pageTitle.length).to.be.at.most(68)
  })

  it('keeps a long caption whole and puts the date in the description instead', () => {
    // Truncating the assembled title threw the subject away, which is the one part people
    // click on; the month still reaches the crawler through meta description.
    const seo = buildSeoFields({ sidecar, entityLabel: 'photo', imageIdText: UUID })
    expect(seo.pageTitle).to.contain('Golden retriever puppy on the beach at sunset')
    expect(seo.pageTitle.length).to.be.at.most(68)
    expect(seo.metaDescription).to.contain('Sep 2025')
    expect(seo.metaDescription.length).to.be.at.most(158)
  })

  it('falls back to a unique id-based title when there is no caption or label', () => {
    const seo = buildSeoFields({ sidecar: {}, entityLabel: 'video', imageIdText: UUID })
    expect(seo.pageTitle).to.equal(`wisaw video ${UUID}`)
  })

  it('de-dupes labels and keeps them out of the title when a caption exists', () => {
    const seo = buildSeoFields({ sidecar, entityLabel: 'photo', imageIdText: UUID })
    expect(seo.labels).to.deep.equal(['Dog', 'Pet', 'Beach', 'Sunset'])
  })

  // og:image:title and og:image:caption must not be two copies of one string: the tags answer
  // "what is in the image" (Rekognition), the comment answers "what do people say about it".
  it('splits the image tags: title from the AI tags, caption from the comments', () => {
    const seo = buildSeoFields({ sidecar, entityLabel: 'photo', imageIdText: UUID })
    expect(seo.imageTitle).to.equal('Dog, Pet, Beach')
    expect(seo.imageCaption).to.equal('Golden retriever puppy on the beach at sunset')
    expect(seo.imageTitle).to.not.equal(seo.imageCaption)
  })

  it('omits the caption when nobody has commented instead of repeating the tags', () => {
    const seo = buildSeoFields({
      sidecar: { labels: ['Cat', 'Sofa'] },
      entityLabel: 'photo',
      imageIdText: UUID
    })
    expect(seo.imageTitle).to.equal('Cat, Sofa')
    expect(seo.imageCaption).to.equal('')
  })

  it('falls back to the page title for og:image:title when the photo has no tags', () => {
    const seo = buildSeoFields({
      sidecar: { caption: 'just a comment' },
      entityLabel: 'photo',
      imageIdText: UUID
    })
    expect(seo.imageTitle).to.equal(seo.pageTitle)
    expect(seo.imageCaption).to.equal('just a comment')
  })

  it('emits a meta description even when the caption is empty', () => {
    const seo = buildSeoFields({
      sidecar: { labels: ['Cat'], created: '2025-01-02T00:00:00Z' },
      entityLabel: 'photo',
      imageIdText: UUID
    })
    expect(seo.metaDescription).to.match(/cat/i)
    expect(seo.metaDescription.length).to.be.at.most(158)
  })

  it('keeps the id in the title when nothing is known, so pages stay unique', () => {
    const seo = buildSeoFields({ sidecar: null, entityLabel: 'photo', imageIdText: UUID })
    expect(seo.pageTitle).to.equal(`wisaw photo ${UUID}`)
  })

  it('refuses a placeholder or nonsense capture date instead of claiming freshness', () => {
    expect(monthYear('')).to.equal('')
    expect(monthYear('2001-01-01T00:00:00Z')).to.equal('')
    expect(monthYear('not-a-date')).to.equal('')
  })
})

// "Photos"."location" is a Postgres geography column. However its value reaches a writer -
// object, WKB hex, POINT() text or a bare pair - it must not survive into the <id>.json sidecar,
// while the address columns (locality/district/region) are expected to.
const GEOMETRY_FORMS = {
  pointObject: { latitude: 40.6833, longitude: -73.974 },
  wkbHex: '0101000020E6100000C3F5A74271D04440CD5AB69B102252C0',
  pointText: 'POINT(-73.9740 40.6833)',
  pairText: '40.6833, -73.9740'
}

describe('<id>.json sidecar - a place name is fine, a coordinate never is', () => {
  const row = {
    id: UUID,
    lastComment: 'Golden retriever puppy on the beach at sunset',
    createdAt: '2025-09-18T14:03:00.000Z',
    width: '3024',
    height: '4032',
    labels: ['Dog', 'Pet'],
    locality: 'Coney Island',
    district: 'Brooklyn',
    region: 'New York'
  }

  it('publishes the place name built from the address columns', () => {
    expect(buildSeoSidecar(row).location).to.equal('Coney Island, Brooklyn, New York')
  })

  it('ignores a geometry column on the row however it is shaped', () => {
    for (const [shape, value] of Object.entries(GEOMETRY_FORMS)) {
      const body = buildSeoSidecar({ ...row, location: value })
      expect(body.location, shape).to.equal('Coney Island, Brooklyn, New York')
      expect(JSON.stringify(body), shape).to.not.contain('73.974')
    }
  })

  it('refuses to publish a sidecar whose location is a coordinate', () => {
    for (const [shape, value] of Object.entries(GEOMETRY_FORMS)) {
      const poisoned = { ...buildSeoSidecar(row), location: value }
      expect(() => assertNoPreciseLocation(poisoned), shape).to.throw(/coordinate/)
    }
    expect(() => assertNoPreciseLocation({ v: 1, lat: 40.6833 })).to.throw(/coordinate/)
    expect(() => assertNoPreciseLocation({ v: 1, latitude: 40.6833 })).to.throw(/coordinate/)
  })

  it('the backfill script publishes the same keys and ignores the geometry column too', () => {
    const fromScript = buildSidecar(row)
    const fromUtility = buildSeoSidecar(row)
    expect(Object.keys(fromScript).sort()).to.deep.equal(Object.keys(fromUtility).sort())
    expect(fromScript.v).to.equal(fromUtility.v)
    expect(fromScript.location).to.equal('Coney Island, Brooklyn, New York')
    expect(buildSidecar({ ...row, location: GEOMETRY_FORMS.wkbHex }).location)
      .to.equal('Coney Island, Brooklyn, New York')
  })

  it('the backfill query selects the address columns and never the geography column', () => {
    expect(QUERY).to.match(/"locality"/)
    expect(QUERY).to.match(/"region"/)
    expect(QUERY).to.not.match(/p\."location"|ST_As|ST_Distance|latitude|longitude/i)
  })

  it('the edge reader drops coordinates and keeps the place name', () => {
    const poisoned = {
      v: 1,
      caption: 'Sunset over the boardwalk',
      labels: ['Beach'],
      location: GEOMETRY_FORMS.pointText,
      lat: 40.6833,
      lon: -73.974,
      latitude: 40.6833,
      width: '3024'
    }
    const read = stripPreciseLocation(JSON.parse(JSON.stringify(poisoned)))
    for (const key of ['lat', 'lon', 'latitude']) expect(read, key).to.not.have.property(key)
    expect(JSON.stringify(read)).to.not.contain('73.974')
    expect(stripPreciseLocation({ v: 1, location: { latitude: 1, longitude: 2 } })).to.not.have.property('location')
    // And a normal sidecar comes back untouched - the place name is what the titles are built from.
    const named = stripPreciseLocation({ v: 1, caption: 'Sunset', location: 'Coney Island, Brooklyn' })
    expect(named.location).to.equal('Coney Island, Brooklyn')
    expect(buildSeoFields({ sidecar: named, entityLabel: 'photo', imageIdText: UUID }).pageTitle)
      .to.contain('Coney Island')
  })
})

describe('injectMetaTags against the served shell', () => {
  const injected = injectMetaTags(SHELL, {
    description: 'Golden retriever puppy on the beach - free photo on WiSaw.',
    metaDescription: 'Golden retriever puppy on the beach - free photo on WiSaw.',
    entityLabel: 'photo',
    ogType: 'photo',
    pathSegment: 'photos',
    imageIdText: UUID,
    imageIdUrl: UPPER_UUID,
    pageTitle: 'Golden retriever puppy — photo, Sep 2025 · WiSaw',
    bodyHtml: '<h1>Golden retriever puppy</h1>'
  })

  it('emits exactly one canonical and it points at this page, lowercased', () => {
    const links = canonicalsOf(injected)
    expect(links).to.have.lengthOf(1)
    expect(links[0]).to.contain(`https://wisaw.com/photos/${UUID}`)
    expect(links[0]).to.not.contain(UPPER_UUID)
  })

  it('never leaves a homepage canonical behind', () => {
    expect(canonicalsOf(injected).join(' ')).to.not.contain('href="https://wisaw.com/"')
    expect(canonicalsOf(injected).join(' ')).to.not.match(/href=["']https:\/\/wisaw\.com["']/)
  })

  it('adds a name=description tag and keeps only one description', () => {
    expect(countOf(injected, /<meta\s[^>]*name=["']description["']/gi)).to.equal(1)
    expect(injected).to.match(/name="description"[^>]*content="Golden retriever puppy/)
  })

  it('keeps the crawler directives and the root mount point intact', () => {
    expect(injected).to.match(/name="robots"[^>]*content="index, follow/)
    expect(injected).to.match(/<div id="root">/)
    expect(countOf(injected, /<title>/gi)).to.equal(1)
  })

  it('leaves every script in the served shell alone', () => {
    // The stale-deploy guard and the bundle entry are both inline/module scripts; swallowing
    // either one turns a crawler render into a page the browser cannot hydrate.
    expect(countOf(injected, /<script/gi)).to.equal(countOf(SHELL, /<script/gi))
    expect(injected).to.contain('type="module"')
  })
})

describe('injectRouteTags for the non-media routes', () => {
  const injected = injectRouteTags(SHELL, {
    title: 'About WiSaw — unaltered photos and videos from phone cameras',
    description: 'What WiSaw is and why it exists.',
    canonical: 'https://wisaw.com/about'
  })

  it('gives the route its own canonical instead of the homepage one', () => {
    const links = canonicalsOf(injected)
    expect(links).to.have.lengthOf(1)
    expect(links[0]).to.contain('https://wisaw.com/about')
  })

  it('rewrites the title and description for the route', () => {
    expect(injected).to.match(/<title>About WiSaw/)
    expect(countOf(injected, /<meta\s[^>]*name=["']description["']/gi)).to.equal(1)
    expect(countOf(injected, /property=["']og:description["']/gi)).to.equal(1)
  })

  it('works on a shell that has no canonical link at all', () => {
    const links = canonicalsOf(injectRouteTags(SHELL, { canonical: 'https://wisaw.com/', title: 'WiSaw' }))
    expect(links).to.have.lengthOf(1)
  })
})

describe('crawler directives and the not-found document', () => {
  it('marks dead ids noindex and cacheable for a day', () => {
    const res = htmlResponse(404, renderNotFoundDocument('photo'), { noindex: true, cacheControl: 'max-age=86400' })
    expect(res.status).to.equal('404')
    expect(res.statusDescription).to.equal('Not Found')
    expect(res.headers['cache-control'][0].value).to.equal('max-age=86400')
    expect(res.headers['x-robots-tag'][0].value).to.equal('noindex, follow')
  })

  it('marks live pages indexable', () => {
    const res = htmlResponse(200, '<html></html>')
    expect(res.headers['x-robots-tag'][0].value).to.equal('index, follow')
    expect(res.headers['cache-control'][0].value).to.equal('max-age=100')
  })

  it('ships a self-contained 404 document with noindex and one canonical', () => {
    const doc = renderNotFoundDocument('photo')
    expect(doc).to.match(/name="robots" content="noindex, follow"/)
    expect(canonicalsOf(doc)).to.have.lengthOf(1)
    expect(doc).to.match(/<h1>This photo no longer exists<\/h1>/)
  })
})
