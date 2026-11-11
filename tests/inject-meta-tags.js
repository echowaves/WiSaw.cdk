/* eslint-env node */
const { expect } = require('chai')
const { describe, it } = require('mocha')
const fs = require('fs')
const path = require('path')

const { injectMetaTags, stripExistingMetaTags, buildSeoBody, renderRootBody, injectRouteTags, htmlResponse } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils')

// What Googlebot is served today. The mount-point tests below run against the real shell because
// every hand-written approximation of it has so far been too friendly to catch a bad cut.
const SERVED_SHELL = fs.readFileSync(path.join(__dirname, 'fixtures', 'served-index.html'), 'utf8')

function countOf (text, pattern) {
  return (text.match(pattern) || []).length
}

/** Captures console.error so the fail-safe rows can prove they logged the give-up. */
function captureConsoleError () {
  const lines = []
  const original = console.error
  console.error = (...args) => { lines.push(args.map(String).join(' ')) }
  return {
    lines,
    restore () { console.error = original }
  }
}

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
    // The preview image is the thumbnail - the same file the browser app publishes and the
    // sitemap lists as thumbnail_loc. Naming a second file as the page's picture made the
    // three surfaces disagree about what a page depicts.
    expect(result).to.include('https://img.wisaw.com/abc-123-thumb.webp')
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
    expect(result).to.include('https://img.wisaw.com/abc-123-thumb.webp')
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
  // The template's site name and robots tag used to survive alongside the injected ones, so a
  // crawler read two values for one property. They are replaced now, not preserved.
  it('replaces the template og:site_name with one value', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect((result.match(/property=["']og:site_name["']/gi) || [])).to.have.lengthOf(1)
    expect(result).to.not.include('content="WiSaw"\n')
  })

  // Locale used to be left alone because nothing injected a second copy. It is edge-owned now —
  // stripped, then re-emitted with data-rh so the app can keep exactly one of them.
  it('replaces the template og:locale with one marked value', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect((result.match(/property=["']og:locale["']/gi) || [])).to.have.lengthOf(1)
    expect(result).to.include('og:locale" content="en_US" data-rh="true"')
  })

  it('replaces the template robots tag with one directive', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect((result.match(/name=["']robots["']/gi) || [])).to.have.lengthOf(1)
    expect(result).to.not.include('content="index, follow" />')
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

  // One test per row of the plan's I/O matrix. The old locator was
  // /(<div id="root">)[\s\S]*?(<\/div>)/i: first anchor anywhere won, nearest </div> won, and
  // nothing checked the result - which is how a photo page went out with its body cut short.
  describe('renderRootBody - mount point located structurally', () => {
    const SEO_BODY = buildSeoBody({
      entityLabel: 'photo',
      pathSegment: 'photos',
      imageIdText: 'abc-123',
      description: 'A sunset over the pier'
    })

    // Row 1 - happy path on the shell production serves.
    it('replaces only the mount point contents in the served shell', () => {
      const result = renderRootBody(SERVED_SHELL, SEO_BODY)
      expect(result).to.include('src="https://img.wisaw.com/abc-123.webp"')
      expect(result).to.not.include('Unaltered Photos and Videos, Taken with Phone Cameras.')
      // One script added by the crawler body (its JSON-LD block); none of the shell's lost.
      expect(countOf(result, /<script\b/gi)).to.equal(countOf(SERVED_SHELL, /<script\b/gi) + 1)
      const moduleScript = /<script\b[^>]*type="module"[^>]*><\/script>/i.exec(SERVED_SHELL)
      expect(moduleScript).to.not.equal(null)
      expect(result).to.include(moduleScript[0])
      expect(result).to.include('type="module"')
      expect(result).to.include('rel="stylesheet"')
      expect(result).to.include('wisaw-reload-at')
      expect(countOf(result, /<div\b[^>]*\bid=["']root["']/gi)).to.equal(1)
    })

    // Row 2 - nesting: a child div's close must not be taken for the mount point's own.
    it('stops at the mount point\'s own close when the shell nests divs', () => {
      const html = '<html><body><div id="root"><div class="a"><p>stale</p></div></div>' +
        '<div class="after">KEEP</div></body></html>'
      const result = renderRootBody(html, SEO_BODY)
      expect(result).to.include('<h1>')
      expect(result).to.not.include('stale')
      expect(result).to.include('</div><div class="after">KEEP</div>')
    })

    // Row 3 - a </div> written inside an HTML comment is text, not the end of the mount point.
    it('ignores a </div> that lives inside a comment', () => {
      const html = '<html><body><!-- footer </div> retired --><div id="root"><p>stale</p></div>' +
        '<footer>KEEP</footer></body></html>'
      const result = renderRootBody(html, SEO_BODY)
      expect(result).to.include('<!-- footer </div> retired -->')
      expect(result).to.not.include('stale')
      expect(result).to.include('</footer>')
    })

    // Row 4 - a decoy anchor inside inline JS must not become the mount point.
    it('ignores a <div id="root"> literal inside an inline script', () => {
      const html = '<html><head><script>var t = "<div id=\\"root\\">decoy</div>";</script></head>' +
        '<body><div id="root"><p>stale</p></div><footer>KEEP</footer></body></html>'
      const result = renderRootBody(html, SEO_BODY)
      expect(result).to.include('var t = "<div id=\\"root\\">decoy</div>";')
      expect(result.indexOf('<h1>')).to.be.above(result.indexOf('id="root"'))
      expect(result).to.not.include('stale')
      expect(result).to.include('</footer>')
    })

    // Row 5 - ambiguous mount point: guess nothing.
    it('returns the document unchanged when two mount points are present', () => {
      const html = '<html><body><div id="root"><p>a</p></div><div id="root"><p>b</p></div></body></html>'
      const capture = captureConsoleError()
      try {
        expect(renderRootBody(html, SEO_BODY)).to.equal(html)
      } finally {
        capture.restore()
      }
      expect(capture.lines).to.have.lengthOf(1)
    })

    // Row 6 - missing or unclosed mount point: same fail-safe.
    it('returns the document unchanged when the mount point is missing or never closed', () => {
      const missing = '<html><body><div id="app"><p>a</p></div></body></html>'
      const unclosed = '<html><body><div id="root"><p>a</p></body></html>'
      const capture = captureConsoleError()
      try {
        expect(renderRootBody(missing, SEO_BODY)).to.equal(missing)
        expect(renderRootBody(unclosed, SEO_BODY)).to.equal(unclosed)
      } finally {
        capture.restore()
      }
      expect(capture.lines).to.have.lengthOf(2)
    })

    // Row 7 - post-condition: a cut that would eat the bundle entry or the stylesheet is refused.
    it('refuses an injection that would swallow the module script', () => {
      const html = '<html><head><link rel="stylesheet" href="/assets/a.css"></head>' +
        '<body><div id="root"><script type="module" crossorigin src="/assets/i.js"></script>' +
        '<div>x</div></div></body></html>'
      const capture = captureConsoleError()
      try {
        expect(renderRootBody(html, SEO_BODY)).to.equal(html)
      } finally {
        capture.restore()
      }
      expect(capture.lines).to.have.lengthOf(1)
      expect(capture.lines[0]).to.include('boot-critical')
    })

    // Row 8 - degenerate input keeps the old contract: the document comes back as it was.
    it('returns degenerate input unchanged without throwing', () => {
      const capture = captureConsoleError()
      try {
        expect(renderRootBody(SERVED_SHELL, '')).to.equal(SERVED_SHELL)
        expect(renderRootBody(null, SEO_BODY)).to.equal(null)
        expect(renderRootBody(undefined, SEO_BODY)).to.equal('')
        expect(renderRootBody(42, SEO_BODY)).to.equal(42)
      } finally {
        capture.restore()
      }
    })

    it('tolerates attribute order and single quotes on the mount point', () => {
      const html = '<html><body><div class="x" id=\'root\'><p>stale</p></div></body></html>'
      expect(renderRootBody(html, SEO_BODY)).to.include('<h1>')
    })

    it('does not treat data-id or a longer id value as the mount point', () => {
      const html = '<html><body><div data-id="root"><p>a</p></div><div id="rooting"><p>b</p></div></body></html>'
      expect(renderRootBody(html, SEO_BODY)).to.equal(html)
    })

    // Review finding: a bare `<` in text (`a < b`, `100 < 50%`) is valid HTML but is not a tag
    // start. Reading it as one swallowed the following <script> into a bogus tag, resumed the
    // scan inside the script body and let the decoy `</div>` cut the document mid-script. The
    // post-condition did not catch that variant - the orphaned tail still held a <script>.
    it('treats a bare < in text as text, not as a tag start', () => {
      const html = '<html><body><div id="root"><p>a < b</p>' +
        "<script>var decoy = '</div>';</script><p>stale</p></div></body></html>"
      const out = renderRootBody(html, SEO_BODY)
      expect(out).to.not.equal(html)
      expect(out).to.include('<h1>')
      expect(out).to.not.include('stale')
      expect(out).to.not.include("';</script>")
      expect(countOf(out, /<div\b[^>]*\bid=["']root["']/gi)).to.equal(1)
    })

    // Pins the rule that a raw-text element ends only at its own close tag: `</textarea>` written
    // inside script text must not stop the masking of that script.
    it('masks a script whose text mentions another element close tag', () => {
      const html = '<html><body><div id="root"><p>a</p>' +
        "<script>var s = \"</textarea>\"; var d = '</div>';</script><p>stale</p></div></body></html>"
      const out = renderRootBody(html, SEO_BODY)
      expect(out).to.not.equal(html)
      expect(out).to.include('<h1>')
      expect(out).to.not.include('stale')
      expect(out).to.not.include('</textarea>')
      expect(countOf(out, /<div\b[^>]*\bid=["']root["']/gi)).to.equal(1)
    })
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
    expect(tagsOf(result, 'og:image')[0]).to.contain('abc-123-thumb.webp')

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

describe('one tag per property, both crawlers', () => {
  const count = (html, re) => (html.match(re) || []).length

  it('emits exactly one robots directive carrying data-rh', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect(count(result, /<meta\s[^>]*name=["']robots["']/gi)).to.equal(1)
    expect(result).to.match(/name="robots"[^>]*content="index, follow/)
    expect(result).to.match(/name="robots"[^>]*data-rh=/)
  })

  it('emits one og:site_name, reconcilable by the browser app', () => {
    const result = injectMetaTags(BASE_HTML, PHOTO_OPTIONS)
    expect(count(result, /<meta\s[^>]*property=["']og:site_name["']/gi)).to.equal(1)
    // Without data-rh the browser app cannot see this tag, so it adds its own and a crawler
    // reads two site names for one page.
    expect(result).to.match(/property="og:site_name"[^>]*data-rh=/)
    expect(result).to.include('content="WiSaw"')
  })

  it('names the thumbnail as the preview image in structured data too', () => {
    const body = buildSeoBody({ imageIdText: 'abc-123', entityLabel: 'video', videoUrl: 'https://img.wisaw.com/abc-123.mov' })
    expect(body).to.include('"thumbnailUrl":"https://img.wisaw.com/abc-123-thumb.webp"')
  })

  it('states the same crawler decision in the head and in the header', () => {
    // Comparing only the first directive would let a header say "noindex, follow" while the
    // body said "noindex, nofollow", which is exactly the disagreement being prevented here.
    for (const noindex of [true, false]) {
      const html = injectRouteTags(BASE_HTML, { title: 'Search', canonical: 'https://wisaw.com/search', noindex })
      const meta = html.match(/name="robots"[^>]*content="([^"]+)"/)[1]
      const header = htmlResponse(200, html, { noindex }).headers['x-robots-tag'][0].value
      expect(meta.split(',').map((part) => part.trim())).to.deep.include.members(header.split(',').map((part) => part.trim()))
    }
  })
})

describe('every injected head tag is reconcilable', () => {
  // The browser app only updates or removes tags it marked itself (data-rh). A tag written
  // without it is invisible: never updated, never removed, so the app adds a second copy and
  // a crawler reads two values for one property. This is the whole reason the SPA used to
  // rewrite the head it was given.
  const HEAD_TAGS = /<meta\s[^>]*>/gi

  // Tags the template owns and neither side reconciles (charset, viewport, og:locale). They are
  // allowed to stay unmarked; what must not happen is the injector adding one.
  function unmarked (html) {
    const head = html.slice(0, html.indexOf('</head>'))
    return (head.match(HEAD_TAGS) || []).filter((tag) => !/data-rh=/.test(tag))
  }

  const BASELINE = unmarked(BASE_HTML)

  function newlyUnmarked (html) {
    return unmarked(html).filter((tag) => !BASELINE.includes(tag))
  }

  it('marks every media tag it injects', () => {
    const result = injectMetaTags(BASE_HTML, { ...PHOTO_OPTIONS, imageTitle: 'Dog, Pet', imageCaption: 'On the beach' })
    expect(newlyUnmarked(result)).to.deep.equal([])
  })

  it('marks video tags too', () => {
    const result = injectMetaTags(BASE_HTML, { ...PHOTO_OPTIONS, pathSegment: 'videos', ogType: 'video.other', videoUrl: 'https://img.wisaw.com/abc-123.mov' })
    expect(newlyUnmarked(result)).to.deep.equal([])
  })

  it('marks every static-route tag it injects', () => {
    const result = injectRouteTags(BASE_HTML, { title: 'About', description: 'Why we exist', canonical: 'https://wisaw.com/about' })
    expect(newlyUnmarked(result)).to.deep.equal([])
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

  it('strips og:site_name in either quote style and self-closed', () => {
    // The injector writes its own site name, so a template copy left behind is a second value
    // for one property - which is what the browser app then had to reconcile or duplicate.
    expect(stripExistingMetaTags('<meta property="og:site_name" content="WiSaw" />')).to.equal('')
    expect(stripExistingMetaTags("<meta property='og:site_name' content='wisaw.com'>")).to.equal('')
  })

  it('strips a robots tag', () => {
    // A page must carry one crawler directive, so the template's is replaced rather than joined.
    const html = '<meta name="robots" content="index, follow" data-rh="true" />'
    expect(stripExistingMetaTags(html)).to.equal('')
  })

  it('strips og:locale so the injected copy is the only one', () => {
    const html = '<meta property="og:locale" content="fr_FR" />'
    expect(stripExistingMetaTags(html)).to.not.include('og:locale')
  })

  it('handles tags with single quotes', () => {
    const html = "<meta property='og:image' content='https://example.com/logo.png' />"
    expect(stripExistingMetaTags(html)).to.equal('')
  })
})

describe('video length on the first byte', () => {
  const videoOptions = {
    entityLabel: 'video',
    ogType: 'video',
    pathSegment: 'videos',
    imageIdText: 'vid-9',
    imageIdUrl: 'vid-9',
    videoUrl: 'https://img.wisaw.com/vid-9.mov'
  }

  function videoHead (overrides) {
    const opts = { ...videoOptions, ...overrides }
    return injectMetaTags(BASE_HTML, { ...opts, bodyHtml: buildSeoBody(opts) })
  }

  it('states the length in seconds for crawlers and in ISO 8601 for the graph', () => {
    const html = videoHead({ videoDuration: 3725, duration: 3725 })
    expect(html).to.include('<meta property="og:video:duration" content="3725"')
    expect(html).to.include('"duration":"PT1H2M5S"')
  })

  it('omits both when nobody ever measured the file', () => {
    // A guessed length is a wrong fact about someone's video, and Google reads the graph
    // duration as a claim about the actual file.
    const html = videoHead({ videoDuration: null, duration: null })
    expect(html).to.not.include('og:video:duration')
    expect(html).to.not.include('"duration"')
  })

  it('ignores a length that is not a positive number of seconds', () => {
    for (const junk of ['yesterday', '-4', 0, undefined]) {
      const html = videoHead({ videoDuration: junk, duration: junk })
      expect(html).to.not.include('og:video:duration')
      expect(html).to.not.include('"duration"')
    }
  })

  it('accepts the clock form a legacy sidecar stored', () => {
    const html = videoHead({ videoDuration: '1:02:03', duration: '1:02:03' })
    expect(html).to.include('<meta property="og:video:duration" content="3723"')
    expect(html).to.include('"duration":"PT1H2M3S"')
  })

  it('says nothing about length on a photo page', () => {
    const html = injectMetaTags(BASE_HTML, {
      entityLabel: 'photo',
      ogType: 'article',
      pathSegment: 'photos',
      imageIdText: 'p-1',
      videoDuration: 48,
      bodyHtml: buildSeoBody({ entityLabel: 'photo', duration: 48 })
    })
    expect(html).to.not.include('og:video:duration')
    expect(html).to.not.include('"duration"')
  })
})
