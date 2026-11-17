/* eslint-env node */
/* global require, module, __dirname */

// The detail page template is authored once, in
// lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton.js, and published into the browser app by
// scripts/publish-detail-template.js. Both sides render it: Lambda@Edge paints it into #root, and the
// app paints the same markup for every detail render the edge did not (prev/next navigation, local
// development, a stale edge cache) so one page cannot have two looks.
//
// These checks are what make that claim true rather than aspirational: an app copy that quietly goes
// stale renders a different page from the one a crawler already indexed, which is exactly the failure
// the shared module exists to remove.

const { expect } = require('chai')
const { describe, it } = require('mocha')
const fs = require('fs')
const path = require('path')

const skeleton = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton')
const { buildSeoBody, thumbUrl } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils')
const { renderDetailTemplateModule, TARGET } = require('../scripts/publish-detail-template')

const GOLDEN_BODIES = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'edge-detail-bodies.json'), 'utf8')
)

/** The records the golden bodies were cut from. Editing these without re-cutting the fixture must fail. */
const BODY_CASES = {
  photoFull: { entityLabel: 'photo', pathSegment: 'photos', imageIdText: '2f3c38f7-9c2d-4c8b-9098-894070265dd7', pageTitle: 'Leaf, Plant, Tree — photo · WiSaw', description: 'Leaf, Plant, Tree unaltered photo. Taken in Canton, Massachusetts.', caption: 'A leaf', labels: ['Leaf', 'Plant', 'Tree'], created: '2026-11-16T13:09:08.523Z', width: '4000', height: '3000' },
  photoBare: { entityLabel: 'photo', pathSegment: 'photos', imageIdText: 'aaaabbbb-cccc-dddd-eeee-ffff00001111' },
  photoNoDims: { entityLabel: 'photo', pathSegment: 'photos', imageIdText: '29461ee8-34dd-4c2b-848f-c16d766713e8', width: '0', height: '', labels: ['xxxxx'] },
  videoFull: { entityLabel: 'video', pathSegment: 'videos', imageIdText: '2f3c38f7-9c2d-4c8b-9098-894070265dd7', pageTitle: 'Sunset — video, Provincetown, Oct 2026 · WiSaw', description: 'Sunset over the harbour.', labels: ['Sunset'], videoUrl: 'https://img.wisaw.com/2f3c38f7-9c2d-4c8b-9098-894070265dd7.mov', created: '2026-10-01T00:00:00.000Z', duration: 42, width: '1080', height: '1920' },
  videoNoDuration: { entityLabel: 'video', pathSegment: 'videos', imageIdText: '00000000-1111-2222-3333-444444444444', videoUrl: 'https://img.wisaw.com/00000000-1111-2222-3333-444444444444.mp4', width: '720', height: '1280' },
  xssLabels: { entityLabel: 'photo', pathSegment: 'photos', imageIdText: '<script>x</script>', labels: ['<img onerror=alert(1)>', 'ok'], caption: '</p><h1>hi</h1>', description: 'a "quoted" & <escaped> one' }
}

/** Same inputs, both media kinds and every dimension state the frame has to survive. */
const MEDIA_CASES = [
  { entityLabel: 'photo', imageUrl: 'https://img.wisaw.com/a.webp', previewUrl: 'https://img.wisaw.com/a-thumb.webp', altText: 'A, B', mediaId: 'a', width: '4000', height: '3000' },
  { entityLabel: 'photo', imageUrl: 'https://img.wisaw.com/a.webp', previewUrl: 'https://img.wisaw.com/a-thumb.webp', altText: '"quoted" & <tag>', mediaId: '<x>', width: '0', height: '' },
  { entityLabel: 'video', previewUrl: 'https://img.wisaw.com/a-thumb.webp', videoUrl: 'https://img.wisaw.com/a.mov', mediaId: 'a', width: '1080', height: '1920' },
  {}
]

const DIMENSION_CASES = ['4000', '3000', '0', '', null, undefined, ' 12 ', '-4', '1.5', '1e3', '9007199254740993']

/** Evaluate the published ES module as CommonJS: an export renamed or dropped here would leave the
 *  app importing `undefined` and quietly rendering nothing. */
function loadPublishedModule () {
  const names = Object.keys(skeleton)
  const emitted = renderDetailTemplateModule()
  const cut = emitted.lastIndexOf('\nexport {\n')
  if (cut === -1) throw new Error('the published module no longer ends in a named export list')
  const source = emitted.slice(0, cut) + '\nmodule.exports = { ' + names.join(', ') + ' }'
  const box = { exports: {} }
  new Function('module', source)(box)
  return box.exports
}

const committed = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : null

describe('the detail template is authored once and published to both sides', () => {
  it('emits a module that exports exactly what the edge module exports', () => {
    const published = loadPublishedModule()
    expect(Object.keys(published).sort()).to.deep.equal(Object.keys(skeleton).sort())
  })

  it('agrees with the edge on every constant', () => {
    const published = loadPublishedModule()
    for (const [name, value] of Object.entries(skeleton)) {
      if (typeof value === 'function') continue
      expect(published[name], name).to.deep.equal(value)
    }
  })

  it('agrees with the edge on dimension parsing and box geometry', () => {
    const published = loadPublishedModule()
    for (const value of DIMENSION_CASES) {
      expect(published.positiveInt(value), String(value)).to.deep.equal(skeleton.positiveInt(value))
    }
    for (const w of ['4000', '1080', '0', '', null]) {
      for (const h of ['3000', '1920', '0', '', undefined]) {
        expect(published.mediaBoxStyle(w, h), `${w}x${h}`).to.equal(skeleton.mediaBoxStyle(w, h))
      }
    }
  })

  it('agrees with the edge on the media element, escaping included', () => {
    const published = loadPublishedModule()
    for (const testCase of MEDIA_CASES) {
      expect(published.mediaElement(testCase)).to.equal(skeleton.mediaElement(testCase))
    }
    for (const nasty of ['<script>', '"a" & \'b\'', 'https://x/y?a=1&b=2']) {
      expect(published.escapeHtmlAttribute(nasty)).to.equal(skeleton.escapeHtmlAttribute(nasty))
    }
  })

  it('agrees with the edge on the frame and the breadcrumb graph', () => {
    const published = loadPublishedModule()
    const parts = {
      mediaHtml: skeleton.mediaElement(MEDIA_CASES[0]),
      boxStyle: skeleton.mediaBoxStyle('4000', '3000'),
      title: 'Leaf, Plant, Tree — photo · WiSaw',
      descriptionHtml: '<p>Leaf, Plant, Tree unaltered photo.</p>',
      labelLinksHtml: '<p><a rel="tag" href="/search/Leaf">Leaf</a></p>',
      navHtml: '<nav><a href="/">WiSaw</a></nav>'
    }
    expect(published.renderSkeleton(parts)).to.equal(skeleton.renderSkeleton(parts))
    expect(published.renderSkeleton()).to.equal(skeleton.renderSkeleton())
    expect(published.breadcrumbGraph({ title: 'T', pageUrl: 'https://wisaw.com/photos/a' }))
      .to.deep.equal(skeleton.breadcrumbGraph({ title: 'T', pageUrl: 'https://wisaw.com/photos/a' }))
  })

  describe('the frame stylesheet is host-agnostic', () => {
    it('carries no mount-point ancestor prefix, so it styles the frame in either host', () => {
      // The edge paints into #root; React paints into #wisaw-app. A rule scoped to one of them
      // silently leaves the other unstyled, which is what made a navigated detail page look like a
      // different template than the same id loaded directly.
      for (const host of ['#root', '#wisaw-app']) {
        expect(skeleton.SKELETON_STYLE, host).to.not.contain(host)
      }
    })

    it('stays free of angle brackets so the mount-point scanner survives it', () => {
      expect(skeleton.SKELETON_STYLE.replace(/^<style>/, '').replace(/<\/style>$/, '')).to.not.match(/[<>]/)
    })
  })

  // The contract only exists when both repos are checked out side by side; a standalone backend
  // checkout skips rather than fails, matching tests/static-route-copy-once.js.
  const describeCommitted = committed === null ? describe.skip : describe
  describeCommitted('the copy committed in the app repository is this module', () => {
    it('is committed and marked generated', () => {
      expect(committed).to.contain('GENERATED')
    })

    it('matches the edge module byte for byte', () => {
      expect(committed).to.equal(renderDetailTemplateModule())
    })

    it('still holds the whole authored body, not just its exports', () => {
      const source = fs.readFileSync(path.join(__dirname, '..', 'lambda-fns', 'lambdas', 'injectMetaTagsLambdaFunction', 'skeleton.js'), 'utf8')
      const body = source.slice(source.indexOf('const DETAIL_MAX_SIDE'), source.indexOf('\nmodule.exports = {'))
      expect(committed).to.contain(body.trimEnd())
    })
  })

  describe('one function builds the page on both sides', () => {
    it('leaves the body builder no frame markup of its own to write', () => {
      const utilsSource = fs.readFileSync(path.join(__dirname, '..', 'lambda-fns', 'lambdas', 'injectMetaTagsLambdaFunction', 'utils.js'), 'utf8')
      expect(utilsSource).to.contain('detailFrameHtml(')
      for (const fragment of ['class="wsk', 'rel="tag"', 'data-wisaw-slot']) {
        expect(utilsSource, `utils.js is writing ${fragment} again`).to.not.contain(fragment)
      }
      // utils.js still owns the separate "this photo no longer exists" page, so the check on the
      // detail body has to be on the function itself.
      expect(buildSeoBody.toString()).to.not.contain('<h1>')
    })

    it('serves exactly the frame the app would paint for the same record', () => {
      const { imageObjectKey, imgUrl } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/mediaNaming')
      const options = BODY_CASES.photoFull
      const id = encodeURIComponent(options.imageIdText)
      // The URLs come from the same naming helpers the body builder uses; everything else is the
      // record. If these two calls ever disagree, this assertion says so — it is the whole claim of
      // the shared module in one line: a navigated page and a served page render the same bytes.
      const frame = skeleton.detailFrameHtml({
        entityLabel: options.entityLabel,
        imageUrl: imgUrl(imageObjectKey(id)),
        previewUrl: thumbUrl(id),
        altText: options.caption,
        mediaId: options.imageIdText,
        width: options.width,
        height: options.height,
        title: options.pageTitle,
        description: options.description,
        labels: options.labels
      })
      expect(buildSeoBody(options)).to.contain(frame)
    })
  })

  describe('the bytes a crawler is served do not move', () => {
    for (const [name, options] of Object.entries(BODY_CASES)) {
      it(`reproduces the stored body for ${name}`, () => {
        expect(buildSeoBody(options), name).to.equal(GOLDEN_BODIES[name])
      })
    }

    it('carries the frame markup and both structured-data graphs in one body', () => {
      const body = buildSeoBody(BODY_CASES.photoFull)
      expect(body).to.contain('<div class="wsk">')
      expect(body).to.contain('data-wisaw-slot="header"')
      expect(body).to.contain('data-wisaw-slot="below"')
      expect(body.match(/application\/ld\+json/g)).to.have.length(2)
    })
  })
})
