/* eslint-env node */
const { expect } = require('chai')
const { describe, it } = require('mocha')

const { injectMetaTags, stripExistingMetaTags, buildSeoBody, renderRootBody } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils')

// Base HTML matching the real wisaw.com index.html structure
const BASE_HTML = `<!DOCTYPE html>
<html lang="en" prefix="og: http://ogp.me/ns#">
<head>
  <meta charset="utf-8" />
  <title>Free Stock Photos &amp; Videos -- What I Saw</title>
  <meta name="description" property="og:description"
    content="Free Stock Photos and Videos, Royalty Free Stock Images"
    data-rh="true" />
  <meta property="og:type" content="website" data-rh="true" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel='canonical' href="https://wisaw.com" data-rh="true" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.webp" />
  <link rel="icon" type="image/webp" href="/favicon-32x32.webp" sizes="32x32" />
  <meta property="og:site_name" content="WiSaw" />
  <meta property="og:title" content="WiSaw - Free Authentic Stock Photos &amp; Videos" data-rh="true" />
  <meta property="og:image" content="https://wisaw.com/android-chrome-512x512.png" data-rh="true" />
  <meta property="og:url" content="https://wisaw.com" data-rh="true" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" data-rh="true" />
  <meta name="twitter:title" content="WiSaw - Free Authentic Stock Photos &amp; Videos" data-rh="true" />
  <meta name="twitter:description"
    content="Free Stock Photos and Videos" data-rh="true" />
  <meta name="twitter:image" content="https://wisaw.com/android-chrome-512x512.png" data-rh="true" />
  <meta name="robots" content="index, follow" />
</head>
<body>
  <div id="root">
    <h1>Unaltered Photos and Videos, Taken with Phone Cameras.</h1>
  </div>
</body>
</html>`

const PHOTO_OPTIONS = {
  description: 'Check out What I saw Today (photo)',
  entityLabel: 'photo',
  ogType: 'photo',
  pathSegment: 'photos',
  imageIdText: 'abc-123',
  imageIdUrl: 'abc-123'
}

describe('injectMetaTags - duplicate tag removal', () => {
  it('produces exactly one og:image tag', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    const matches = result.match(/<meta\s[^>]*property=["']og:image["']/gi)
    expect(matches).to.have.lengthOf(1)
    expect(result).to.include('https://img.wisaw.com/abc-123.webp')
    expect(result).to.not.include('android-chrome-512x512.png')
  })

  it('produces exactly one og:title tag', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    const matches = result.match(/<meta\s[^>]*property=["']og:title["']/gi)
    expect(matches).to.have.lengthOf(1)
    expect(result).to.include('wisaw photo abc-123')
  })

  it('produces exactly one og:url tag', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    const matches = result.match(/<meta\s[^>]*property=["']og:url["']/gi)
    expect(matches).to.have.lengthOf(1)
    expect(result).to.include('https://wisaw.com/photos/abc-123')
  })

  it('produces exactly one og:type tag', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    const matches = result.match(/<meta\s[^>]*property=["']og:type["']/gi)
    expect(matches).to.have.lengthOf(1)
  })

  it('produces exactly one twitter:image tag', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    const matches = result.match(/<meta\s[^>]*name=["']twitter:image["']/gi)
    expect(matches).to.have.lengthOf(1)
    expect(result).to.include('https://img.wisaw.com/abc-123.webp')
  })

  it('produces exactly one twitter:card tag', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    const matches = result.match(/<meta\s[^>]*name=["']twitter:card["']/gi)
    expect(matches).to.have.lengthOf(1)
  })

  it('produces exactly one twitter:title tag', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    const matches = result.match(/<meta\s[^>]*name=["']twitter:title["']/gi)
    expect(matches).to.have.lengthOf(1)
  })

  it('removes the combined name/property og:description tag', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect(result).to.not.include('name="description" property="og:description"')
  })

  it('removes original twitter:description tag', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    const origMatches = result.match(/Free Stock Photos and Videos"/gi)
    expect(origMatches).to.be.null
  })
})

describe('injectMetaTags - preserved tags', () => {
  it('preserves og:site_name', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect(result).to.include('og:site_name')
  })

  it('preserves og:locale', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect(result).to.include('og:locale')
    expect(result).to.include('en_US')
  })

  it('preserves robots meta tag', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect(result).to.include('name="robots"')
  })

  it('preserves apple-touch-icon', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect(result).to.include('apple-touch-icon')
  })

  it('preserves favicon links', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect(result).to.include('favicon-32x32.webp')
  })

  it('preserves viewport meta tag', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect(result).to.include('name="viewport"')
  })
})

describe('injectMetaTags - canonical rewrite (2026-11 indexing incident)', () => {
  // The deployed wisaw.com template writes the canonical with single-quoted rel and a
  // space before `/>`. The old code replaced one exact double-quoted literal, silently
  // missing on production bytes: every deep page kept canonical -> https://wisaw.com and
  // Google dropped ~22k URLs as duplicates. These fixtures must stay byte-exact.
  const DEPLOYED_CANONICAL = '  <link rel=\'canonical\' href="https://wisaw.com" data-rh="true" />'
  const LEGACY_CANONICAL = '<link rel="canonical" href="https://wisaw.com" data-rh="true"/>'

  it('rewrites the byte-exact deployed canonical form', () => {
    const html = `<html><head><title>t</title>\n${DEPLOYED_CANONICAL}\n</head></html>`
    const result = injectMetaTags(html, PHOTO_OPTIONS)
    expect(result).to.include('href="https://wisaw.com/photos/abc-123"')
    expect(result).to.not.match(/<link[^>]*canonical[^>]*href="https:\/\/wisaw\.com"\s*(data-rh="true")?\s*\/?>/)
  })

  it('rewrites the legacy double-quoted canonical form', () => {
    const html = `<html><head><title>t</title>\n${LEGACY_CANONICAL}\n</head></html>`
    const result = injectMetaTags(html, PHOTO_OPTIONS)
    expect(result).to.include('href="https://wisaw.com/photos/abc-123"')
  })

  it('produces exactly one canonical tag', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    const matches = result.match(/<link[^>]*canonical/gi)
    expect(matches).to.have.lengthOf(1)
  })

  it('injects a self-referencing canonical when the template has none', () => {
    const html = '<html><head><title>t</title></head><body><div id="root"></div></body></html>'
    const result = injectMetaTags(html, PHOTO_OPTIONS)
    const matches = result.match(/<link[^>]*canonical[^>]*>/gi)
    expect(matches).to.have.lengthOf(1)
    expect(matches[0]).to.include('https://wisaw.com/photos/abc-123')
  })

  it('does not disturb the single <title> when injecting without a canonical', () => {
    const html = '<html><head><title>t</title></head><body></body></html>'
    const result = injectMetaTags(html, PHOTO_OPTIONS)
    expect(result.match(/<title>/gi)).to.have.lengthOf(1)
    expect(result).to.not.include('</title></title>')
  })
})

describe('buildSeoBody + renderRootBody - crawler-visible content', () => {
  it('replaces the placeholder root with an h1, image and JSON-LD for photos', () => {
    const bodyHtml = buildSeoBody({
      entityLabel: 'photo',
      pathSegment: 'photos',
      imageIdText: 'abc-123',
      description: 'A sunset over the pier'
    })
    const result = injectMetaTags(BASE_HTML, { ...PHOTO_OPTIONS, bodyHtml })
    expect(result).to.include('<h1>')
    expect(result).to.include('src="https://img.wisaw.com/abc-123.webp"')
    expect(result).to.include('alt="A sunset over the pier"')
    expect(result).to.not.include('Unaltered Photos and Videos, Taken with Phone Cameras.')
    const ld = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(ld).to.not.equal(null)
    const parsed = JSON.parse(ld[1])
    expect(parsed['@type']).to.equal('Photograph')
    expect(parsed.contentUrl).to.equal('https://img.wisaw.com/abc-123.webp')
  })

  it('renders a video element and VideoObject schema for videos', () => {
    const bodyHtml = buildSeoBody({
      entityLabel: 'video',
      pathSegment: 'videos',
      imageIdText: 'vid-9',
      videoUrl: 'https://img.wisaw.com/vid-9.mov'
    })
    const html = BASE_HTML.replace('data-rh="true"/>', 'data-rh="true" />')
    const result = injectMetaTags(html, {
      entityLabel: 'video',
      ogType: 'video',
      pathSegment: 'videos',
      imageIdText: 'vid-9',
      imageIdUrl: 'vid-9',
      bodyHtml
    })
    expect(result).to.include('<video')
    expect(result).to.include('src="https://img.wisaw.com/vid-9.mov"')
    const ld = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(JSON.parse(ld[1])['@type']).to.equal('VideoObject')
  })

  it('escapes HTML in caption and labels', () => {
    const bodyHtml = buildSeoBody({
      entityLabel: 'photo',
      pathSegment: 'photos',
      imageIdText: 'x',
      caption: '<script>alert(1)</script>',
      labels: ['"weird" label']
    })
    expect(bodyHtml).to.not.include('<script>alert(1)</script>')
    expect(bodyHtml).to.include('&lt;script&gt;')
  })

  it('renders label links pointing at /search/', () => {
    const bodyHtml = buildSeoBody({
      entityLabel: 'photo',
      pathSegment: 'photos',
      imageIdText: 'x',
      labels: ['Golden Retriever', 'beach']
    })
    expect(bodyHtml).to.include('href="/search/Golden%20Retriever"')
    expect(bodyHtml).to.include('>beach</a>')
  })

  it('renderRootBody leaves html untouched when no body is provided', () => {
    expect(renderRootBody(BASE_HTML, '')).to.equal(BASE_HTML)
  })

  it('renderRootBody is a no-op when the template has no #root', () => {
    const html = '<html><body><div id="app"></div></body></html>'
    expect(renderRootBody(html, '<h1>hi</h1>')).to.equal(html)
  })
})

// Google's image rich results read this pair. They are the only tags whose content comes from
// two different sources (Rekognition tags vs. user comments), so pinning them here keeps a later
// "simplify" pass from collapsing them back into one string or dropping them with og:image.
describe('injectMetaTags - og:image:title / og:image:caption', () => {
  const WITH_IMAGE_TEXT = {
    ...PHOTO_OPTIONS,
    imageTitle: 'Dog, Pet, Beach',
    imageCaption: 'Golden retriever puppy on the beach'
  }

  function tagsOf (html, property) {
    return html.match(new RegExp('<meta[^>]*property="' + property + '"[^>]*>', 'g')) || []
  }

  it('emits exactly one of each, directly after og:image', () => {
    const result = injectMetaTags(BASE_HTML, WITH_IMAGE_TEXT)
    expect(tagsOf(result, 'og:image:title')).to.have.lengthOf(1)
    expect(tagsOf(result, 'og:image:caption')).to.have.lengthOf(1)
    expect(tagsOf(result, 'og:image')[0]).to.contain('abc-123.webp')

    const lines = result.split('\n')
    const imageIdx = lines.findIndex((l) => l.includes('property="og:image"'))
    expect(lines[imageIdx + 1]).to.contain('og:image:title')
    expect(lines[imageIdx + 2]).to.contain('og:image:caption')
  })

  it('keeps the tags and the caption as separate strings', () => {
    const result = injectMetaTags(BASE_HTML, WITH_IMAGE_TEXT)
    expect(result).to.include('<meta property="og:image:title" content="Dog, Pet, Beach"')
    expect(result).to.include(
      '<meta property="og:image:caption" content="Golden retriever puppy on the beach"'
    )
  })

  it('omits both tags when the sidecar carries neither', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect(result).to.not.include('og:image:title')
    expect(result).to.not.include('og:image:caption')
  })

  it('emits only the title when nobody has commented', () => {
    const result = injectMetaTags(BASE_HTML, { ...PHOTO_OPTIONS, imageTitle: 'Cat, Sofa' })
    expect(tagsOf(result, 'og:image:title')).to.have.lengthOf(1)
    expect(result).to.not.include('og:image:caption')
  })

  it('escapes quotes and ampersands so the tag cannot be broken out of', () => {
    const result = injectMetaTags(BASE_HTML, {
      ...PHOTO_OPTIONS,
      imageTitle: 'Tom & Jerry\'s "beach" day',
      imageCaption: '<script>alert(1)</script>'
    })
    const title = tagsOf(result, 'og:image:title')[0]
    expect(title).to.include('Tom &amp; Jerry')
    expect(title).to.include('&quot;beach&quot;')
    expect(title).to.include('Jerry&#039;s')
    const caption = tagsOf(result, 'og:image:caption')[0]
    expect(caption).to.not.include('<script>')
    expect(caption).to.include('&lt;script&gt;')
  })

  it('replaces tags already present in the served shell instead of duplicating them', () => {
    const once = injectMetaTags(BASE_HTML, WITH_IMAGE_TEXT)
    const twice = injectMetaTags(once, { ...WITH_IMAGE_TEXT, imageTitle: 'Puppy, Beach' })
    expect(tagsOf(twice, 'og:image:title')).to.have.lengthOf(1)
    expect(tagsOf(twice, 'og:image:caption')).to.have.lengthOf(1)
    expect(twice).to.include('content="Puppy, Beach"')
    expect(twice).to.not.include('Dog, Pet, Beach')
  })
})

describe('stripExistingMetaTags', () => {
  it('strips og:image tag', () => {
    const html = '<meta property="og:image" content="https://example.com/logo.png" data-rh="true" />'
    expect(stripExistingMetaTags(html)).to.equal('')
  })

  // The strip pattern for og:image needs the closing quote right after the property name, so
  // without these two the crawler would get a stale pair next to the fresh one.
  it('strips og:image:title and og:image:caption', () => {
    const html = '<meta property="og:image:title" content="old" data-rh="true" />' +
      '<meta property="og:image:caption" content="old" data-rh="true" />'
    expect(stripExistingMetaTags(html)).to.equal('')
  })

  it('strips twitter:image tag', () => {
    const html = '<meta name="twitter:image" content="https://example.com/logo.png" data-rh="true" />'
    expect(stripExistingMetaTags(html)).to.equal('')
  })

  it('strips combined description/og:description tag', () => {
    const html = '<meta name="description" property="og:description" content="test" data-rh="true" />'
    expect(stripExistingMetaTags(html)).to.equal('')
  })

  it('does not strip og:site_name', () => {
    const html = '<meta property="og:site_name" content="WiSaw" />'
    expect(stripExistingMetaTags(html)).to.include('og:site_name')
  })

  it('does not strip og:locale', () => {
    const html = '<meta property="og:locale" content="en_US" />'
    expect(stripExistingMetaTags(html)).to.include('og:locale')
  })

  it('handles tags with single quotes', () => {
    const html = "<meta property='og:image' content='https://example.com/logo.png' />"
    expect(stripExistingMetaTags(html)).to.equal('')
  })
})
