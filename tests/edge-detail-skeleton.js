/* eslint-env node */
const { expect } = require('chai')
const { describe, it } = require('mocha')
const fs = require('fs')
const path = require('path')

const { injectMetaTags, buildSeoBody, videoOgType } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils')
const { SKELETON_STYLE, BELOW_MEDIA_RESERVE_PX, HEADER_DESKTOP_PX, HEADER_MOBILE_PX, DETAIL_UNKNOWN_DIMENSION_CAP_PX } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton')
const { VIDEO_MIME_TYPES, VIDEO_EXTENSIONS } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/mediaNaming')

// The real served shell: the skeleton has to survive the same structural mount-point scan that
// once cut a photo page short, and the client simulates the same injection pass on its side.
const SERVED_SHELL = fs.readFileSync(path.join(__dirname, 'fixtures', 'served-index.html'), 'utf8')

// WiSaw.client src/utils/detailSkeleton.js adopts an edge-painted page only when every one of
// these holds; anything it cannot find makes the app render the route fully client-side, which is
// the LCP/CLS failure this change exists to remove. These tests are the backend half of that pin.
const ROUTE_ID = '29461ee8-34dd-4c2b-848f-c16d766713e8'
const FULL_KEY = `${ROUTE_ID}.webp`
const THUMB_KEY = `${ROUTE_ID}-thumb.webp`

const PHOTO_BODY_OPTIONS = {
  entityLabel: 'photo',
  pathSegment: 'photos',
  imageIdText: ROUTE_ID,
  pageTitle: 'Pier at dusk — photo, Oct 2026 · WiSaw',
  description: 'A pier at dusk, unaltered.',
  caption: 'Pier at dusk',
  labels: ['pier', 'dusk'],
  created: '2026-10-01',
  width: '2250',
  height: '3000'
}

const VIDEO_BODY_OPTIONS = {
  entityLabel: 'video',
  pathSegment: 'videos',
  imageIdText: ROUTE_ID,
  pageTitle: 'Harbour at dusk — video · WiSaw',
  description: 'Harbour at dusk, unaltered.',
  caption: 'Harbour at dusk',
  labels: ['harbour'],
  videoUrl: `https://img.wisaw.com/${ROUTE_ID}.mp4`,
  created: '2026-10-01',
  duration: 48,
  width: '1920',
  height: '1080'
}

function countOf (text, pattern) {
  return (text.match(pattern) || []).length
}

/** Every JSON-LD block on the page, in document order. */
function jsonLdGraphs (html) {
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []
  return blocks.map((block) => JSON.parse(block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')))
}

function metaContent (html, property) {
  const tag = new RegExp(`<meta\\s[^>]*(?:property|name)=["']${property}["'][^>]*>`).exec(html)
  if (!tag) return null
  const content = /content="([^"]*)"/.exec(tag[0])
  return content ? content[1] : ''
}

/** The element the client captures: root.querySelector('[data-wisaw-media]'). */
function mediaTag (body) {
  return (/<(img|video)\b[^>]*data-wisaw-media[^>]*>/i.exec(body) || [])[0] || ''
}

function attr (tag, name) {
  const found = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
  return found ? found[1] : null
}

describe('edge detail skeleton - what the client needs to adopt it', () => {
  it('marks the media node with the adoption attributes, id lower-cased', () => {
    const body = buildSeoBody(PHOTO_BODY_OPTIONS)
    const media = mediaTag(body)
    expect(media).to.not.equal('')
    expect(attr(media, 'data-wisaw-id')).to.equal(ROUTE_ID)
    expect(attr(media, 'width')).to.equal('2250')
    expect(attr(media, 'height')).to.equal('3000')
    expect(parseInt(attr(media, 'width'), 10)).to.be.greaterThan(0)
    expect(parseInt(attr(media, 'height'), 10)).to.be.greaterThan(0)
  })

  it('carries both enhancement slots and a media box that is not the mount point', () => {
    const body = buildSeoBody(PHOTO_BODY_OPTIONS)
    expect(countOf(body, /data-wisaw-slot="header"/g)).to.equal(1)
    expect(countOf(body, /data-wisaw-slot="below"/g)).to.equal(1)
    // The client refuses a skeleton whose media has no positioned box to overlay into: the parent
    // of [data-wisaw-media] must exist and must not be #root.
    const wrapped = /<div class="wsk-box"[^>]*><(img|video)\b[^>]*data-wisaw-media/.test(body)
    expect(wrapped).to.equal(true)
    expect(SKELETON_STYLE).to.match(/\.wsk-box\{position:relative/)
  })

  it('gives the video a src, which adoption requires before it takes over the player', () => {
    const media = mediaTag(buildSeoBody(VIDEO_BODY_OPTIONS))
    expect(attr(media, 'src')).to.equal(`https://img.wisaw.com/${ROUTE_ID}.mp4`)
    expect(media).to.include('data-wisaw-id="' + ROUTE_ID + '"')
  })

  it('publishes one media element only, first in DOM order', () => {
    // The deployed client's swap script rewrites the first img[src]/video[poster] inside #root;
    // a second media element would make that guess ambiguous.
    for (const options of [PHOTO_BODY_OPTIONS, VIDEO_BODY_OPTIONS]) {
      const body = buildSeoBody(options)
      expect(countOf(body, /<(img|video)\b/gi)).to.equal(1)
      expect(body.indexOf('data-wisaw-media')).to.be.below(body.indexOf('<h1>'))
    }
  })

  it('reserves the header band and the below-fold space the app fills in', () => {
    expect(SKELETON_STYLE).to.include(`min-height:${HEADER_DESKTOP_PX}px`)
    expect(SKELETON_STYLE).to.include(`min-height:${HEADER_MOBILE_PX}px`)
    expect(SKELETON_STYLE).to.include(`min-height:${BELOW_MEDIA_RESERVE_PX}px`)
  })

  it('sizes the media box from the record, and falls back to a neutral square without one', () => {
    expect(buildSeoBody(PHOTO_BODY_OPTIONS)).to.include('aspect-ratio:2250/3000')
    // Portrait: the client caps the long side, so the box is narrower than 700 px.
    expect(buildSeoBody(PHOTO_BODY_OPTIONS)).to.include('--wsk-cap:525px')
    expect(buildSeoBody(VIDEO_BODY_OPTIONS)).to.include('aspect-ratio:1920/1080;--wsk-cap:700px')
    const unknown = buildSeoBody({ entityLabel: 'photo', pathSegment: 'photos', imageIdText: ROUTE_ID })
    // With no size to lay out from, the box reserves what the app itself would render
    // (WiSaw.client PhotosComponent: dimensions 300x300). Reserving the 700 px desktop cap painted
    // a bigger box than the page ever became.
    expect(unknown).to.include('aspect-ratio:1/1;--wsk-cap:' + DETAIL_UNKNOWN_DIMENSION_CAP_PX + 'px')
    expect(DETAIL_UNKNOWN_DIMENSION_CAP_PX).to.equal(300)
    expect(mediaTag(unknown)).to.not.match(/\swidth="/)
  })

  it('publishes a size only when the record really has one', () => {
    // A failed extraction stores '0'; text '0' is truthy, so this used to reach the page as
    // width="0" - a wrong fact about the file, and one the client refuses to adopt from anyway.
    for (const dims of [{ width: '0', height: '0' }, { width: 'abc', height: '400' }, { width: '-8', height: '400' }, { width: '', height: '' }]) {
      const body = buildSeoBody(Object.assign({}, PHOTO_BODY_OPTIONS, dims))
      const media = mediaTag(body)
      expect(media, JSON.stringify(dims)).to.not.match(/\s(width|height)="/)
      expect(body, JSON.stringify(dims)).to.not.match(/og:(video|image):width/)
    }
    // A real size survives in both the body and the head, whether it arrives as text or a number.
    const sized = buildSeoBody(Object.assign({}, VIDEO_BODY_OPTIONS, { width: '1920', height: 1080 }))
    expect(mediaTag(sized)).to.include('width="1920" height="1080"')
  })

  it('plays the cold video inline, the way React renders it after adoption', () => {
    // iOS Safari takes a video without playsinline full-screen on first tap. The client sets it on
    // the element it adopts; the paint that arrives before any script must not need that fix.
    const media = mediaTag(buildSeoBody(VIDEO_BODY_OPTIONS))
    expect(media).to.match(/\splaysinline(\s|=)/)
  })

  it('keeps the scoped style small and free of markup-looking text', () => {
    expect(SKELETON_STYLE.length).to.be.below(2048)
    // The mount-point scanner masks a style element's contents, but angle brackets in here would
    // still make the crawler body harder to reason about - and `>` is a child combinator.
    expect(SKELETON_STYLE.replace(/^<style>/, '').replace(/<\/style>$/, '')).to.not.match(/[<>]/)
  })

  it('hides the picture without shifting the page when the object is gone', () => {
    const media = mediaTag(buildSeoBody(PHOTO_BODY_OPTIONS))
    const handler = attr(media, 'onerror')
    expect(handler).to.include('wsk-box--broken')
    // Script-local: no origin, no import, nothing that can throw or reach the network.
    expect(handler).to.not.match(/https?:|fetch|eval|window\./)
    expect(SKELETON_STYLE).to.include('.wsk-box--broken .wsk-media{visibility:hidden}')
  })
})

// Accessibility solicitation round 3 (WiSaw.client brief §10, C6 + C6b), pinned so a later template
// edit cannot quietly undo it: the edge-painted page carries exactly one main landmark — every other
// route in the app does, and React adopts these nodes instead of re-rendering them, so nothing on
// the client side can add it afterwards — and the slot the site Footer portals into is not inside it,
// because a `<footer>` under `<main>` is generic rather than contentinfo.
describe('landmarks on the served detail page', () => {
  /** The column's own markup: from its `<main` open tag to just before it closes. */
  function columnOf (body) {
    const open = body.indexOf('<main')
    const close = body.indexOf('</main>')
    expect(open).to.be.greaterThan(-1)
    expect(close).to.be.greaterThan(open)
    return body.slice(open, close)
  }

  function slotNames (html) {
    return (html.match(/data-wisaw-slot="([a-z]+)"/g) || [])
      .map((found) => found.replace(/^data-wisaw-slot="/, '').replace(/"$/, ''))
  }

  for (const [kind, options] of [['photo', PHOTO_BODY_OPTIONS], ['video', VIDEO_BODY_OPTIONS]]) {
    it(`paints exactly one <main> on a ${kind} page, and no div column`, () => {
      const body = buildSeoBody(options)
      expect(countOf(body, /<main\b/gi)).to.equal(1)
      expect(countOf(body, /<\/main>/gi)).to.equal(1)
      // The rename kept the class; a second copy of the column under either tag would mean two.
      expect(body).to.not.include('<div class="wsk-main"')
    })

    it(`keeps only the below slot inside a ${kind} page's main`, () => {
      const body = buildSeoBody(options)
      // Header sits above the column, footer below it: `below` is the one enhancement React portals
      // into the landmark (comments and recognitions), and it keeps its 220 px reserve there.
      expect(slotNames(columnOf(body))).to.deep.equal(['below'])
      const outside = body.slice(body.indexOf('</main>'))
      expect(countOf(outside, /data-wisaw-slot="footer"/g)).to.equal(1)
      // The footer slot is additive: the adoption pair the client requires is still header + below,
      // so a frame served by an older edge — which has no footer slot — stays adoptable.
      expect(slotNames(body)).to.deep.equal(['header', 'below', 'footer'])
    })
  }

  it('styles the footer band by class, like every other rule in the block', () => {
    // The band is outside `.wsk-main`, so it repeats that column's content box rather than inheriting
    // it; if the rule goes missing the footer stops being inset.
    expect(SKELETON_STYLE).to.include('.wsk-slot-footer{max-width:1100px;margin:0 auto;padding:0 20px}')
    expect(SKELETON_STYLE.length).to.be.below(2048)
  })
})

// WiSaw.client builds its first commit from these two attributes instead of rebuilding an object key
// from the id. Publishing them keeps the naming rule written once per side: after a rename in
// mediaNaming.js, a guessing client paints a URL for an object that was never written.
describe('published media object URLs', () => {
  it('publishes the full-resolution derivative and the thumbnail on a photo', () => {
    const media = mediaTag(buildSeoBody(PHOTO_BODY_OPTIONS))
    expect(attr(media, 'data-wisaw-src')).to.equal(`https://img.wisaw.com/${FULL_KEY}`)
    expect(attr(media, 'data-wisaw-thumb')).to.equal(`https://img.wisaw.com/${THUMB_KEY}`)
  })

  it('publishes the thumbnail as a video\'s image URL, keeping the derivative off the page', () => {
    // The seed wants a picture; the player wants the container, which stays in `src`. A video page must
    // not name the multi-megabyte derivative at all - see 'leaves the full-resolution image out of a
    // video page entirely' - so data-wisaw-src is the thumbnail here, not the photo's full object.
    const media = mediaTag(buildSeoBody(VIDEO_BODY_OPTIONS))
    expect(attr(media, 'data-wisaw-src')).to.equal(`https://img.wisaw.com/${THUMB_KEY}`)
    expect(attr(media, 'data-wisaw-thumb')).to.equal(`https://img.wisaw.com/${THUMB_KEY}`)
    expect(attr(media, 'src')).to.equal(`https://img.wisaw.com/${ROUTE_ID}.mp4`)
  })

  it('names the same file as og:image', () => {
    // One thumbnail per page: the social preview and the client's seed must not be two objects.
    const html = injectMetaTags(SERVED_SHELL, {
      description: 'A pier at dusk, unaltered.',
      entityLabel: 'photo',
      ogType: 'website',
      pathSegment: 'photos',
      imageIdText: ROUTE_ID,
      imageIdUrl: ROUTE_ID,
      pageTitle: PHOTO_BODY_OPTIONS.pageTitle,
      width: '2250',
      height: '3000',
      bodyHtml: buildSeoBody(PHOTO_BODY_OPTIONS)
    })
    expect(metaContent(html, 'og:image')).to.equal(attr(mediaTag(html), 'data-wisaw-thumb'))
  })

  it('publishes each URL attribute exactly once per page', () => {
    // Duplicate attributes would make the client read whichever the parser kept first.
    const body = buildSeoBody(PHOTO_BODY_OPTIONS)
    expect(countOf(body, /data-wisaw-src="/g)).to.equal(1)
    expect(countOf(body, /data-wisaw-thumb="/g)).to.equal(1)
  })
})

describe('video poster - never the full-resolution derivative', () => {
  it('paints the thumbnail as the video poster', () => {
    const body = buildSeoBody(VIDEO_BODY_OPTIONS)
    expect(attr(mediaTag(body), 'poster')).to.equal(`https://img.wisaw.com/${THUMB_KEY}`)
  })

  it('leaves the full-resolution image out of a video page entirely', () => {
    const body = buildSeoBody(VIDEO_BODY_OPTIONS)
    expect(body).to.not.include(FULL_KEY)
    // The shape this replaces: a poster pointing at the multi-megabyte derivative, which is what
    // became the LCP element and cost 20 s on a throttled phone.
    expect(body).to.not.include(`poster="https://img.wisaw.com/${ROUTE_ID}.webp"`)
  })

  it('keeps the photo on the full-resolution object for desktop LCP', () => {
    const body = buildSeoBody(PHOTO_BODY_OPTIONS)
    expect(attr(mediaTag(body), 'src')).to.equal(`https://img.wisaw.com/${FULL_KEY}`)
  })

  it('publishes the whole OG video block in the head, dimensions only when known', () => {
    const html = injectMetaTags(SERVED_SHELL, {
      description: 'Harbour at dusk.',
      entityLabel: 'video',
      ogType: 'video.other',
      pathSegment: 'videos',
      imageIdText: ROUTE_ID,
      imageIdUrl: ROUTE_ID,
      pageTitle: 'Harbour at dusk — video · WiSaw',
      videoUrl: `https://img.wisaw.com/${ROUTE_ID}.mp4`,
      videoDuration: 48,
      width: '1920',
      height: '1080',
      bodyHtml: buildSeoBody(VIDEO_BODY_OPTIONS)
    })
    const videoUrl = `https://img.wisaw.com/${ROUTE_ID}.mp4`
    expect(metaContent(html, 'og:video')).to.equal(videoUrl)
    expect(metaContent(html, 'og:video:url')).to.equal(videoUrl)
    expect(metaContent(html, 'og:video:secure_url')).to.equal(videoUrl)
    expect(metaContent(html, 'og:video:type')).to.equal('video/mp4')
    expect(metaContent(html, 'og:video:image')).to.equal(`https://img.wisaw.com/${THUMB_KEY}`)
    expect(metaContent(html, 'og:video:width')).to.equal('1920')
    expect(metaContent(html, 'og:video:height')).to.equal('1080')
    expect(metaContent(html, 'og:video:duration')).to.equal('48')
  })

  it('names the container the file actually is, per extension', () => {
    // Derived from the one map that owns both facts: an extension added to the naming rule without
    // a container name, or a container name for an extension the injector would never publish,
    // fails here instead of shipping as video/mp4 for everything.
    expect(Object.keys(VIDEO_MIME_TYPES)).to.deep.equal(VIDEO_EXTENSIONS)
    const EXPECTED = { mov: 'video/quicktime', mp4: 'video/mp4', webm: 'video/webm', m4v: 'video/mp4' }
    for (const ext of VIDEO_EXTENSIONS) {
      expect(EXPECTED, `no expectation for .${ext}`).to.have.property(ext)
      expect(videoOgType(`https://img.wisaw.com/${ROUTE_ID}.${ext}`), ext).to.equal(EXPECTED[ext])
      expect(VIDEO_MIME_TYPES[ext], ext).to.equal(EXPECTED[ext])
    }
    // videoObjectKey's documented fallback is <id>.mov; a keyless URL keeps the mp4 default.
    expect(videoOgType(`https://img.wisaw.com/${ROUTE_ID}`)).to.equal('video/mp4')
  })

  it('publishes quicktime for a .mov object instead of claiming mp4', () => {
    const movUrl = `https://img.wisaw.com/${ROUTE_ID}.mov`
    const html = injectMetaTags(SERVED_SHELL, {
      description: 'Harbour at dusk.',
      entityLabel: 'video',
      ogType: 'video.other',
      pathSegment: 'videos',
      imageIdText: ROUTE_ID,
      imageIdUrl: ROUTE_ID,
      videoUrl: movUrl,
      bodyHtml: buildSeoBody({ ...VIDEO_BODY_OPTIONS, videoUrl: movUrl })
    })
    expect(metaContent(html, 'og:video')).to.equal(movUrl)
    expect(metaContent(html, 'og:video:type')).to.equal('video/quicktime')
  })

  it('omits video dimensions rather than guessing them', () => {
    const html = injectMetaTags(SERVED_SHELL, {
      description: 'Harbour at dusk.',
      entityLabel: 'video',
      ogType: 'video.other',
      pathSegment: 'videos',
      imageIdText: ROUTE_ID,
      imageIdUrl: ROUTE_ID,
      videoUrl: `https://img.wisaw.com/${ROUTE_ID}.mp4`,
      bodyHtml: buildSeoBody({ entityLabel: 'video', pathSegment: 'videos', imageIdText: ROUTE_ID, videoUrl: `https://img.wisaw.com/${ROUTE_ID}.mp4` })
    })
    expect(metaContent(html, 'og:video:url')).to.equal(`https://img.wisaw.com/${ROUTE_ID}.mp4`)
    expect(html).to.not.include('og:video:width')
    expect(html).to.not.include('og:video:height')
  })

  it('says nothing about video on a photo page', () => {
    const html = injectMetaTags(SERVED_SHELL, {
      description: 'A pier at dusk.',
      entityLabel: 'photo',
      ogType: 'photo',
      pathSegment: 'photos',
      imageIdText: ROUTE_ID,
      imageIdUrl: ROUTE_ID,
      bodyHtml: buildSeoBody(PHOTO_BODY_OPTIONS)
    })
    expect(html).to.not.include('og:video')
  })
})

describe('JSON-LD on a detail page', () => {
  it('publishes the media graph first and the breadcrumb second', () => {
    const photo = jsonLdGraphs(buildSeoBody(PHOTO_BODY_OPTIONS))
    expect(photo.map((graph) => graph['@type'])).to.deep.equal(['Photograph', 'BreadcrumbList'])
    const video = jsonLdGraphs(buildSeoBody(VIDEO_BODY_OPTIONS))
    expect(video.map((graph) => graph['@type'])).to.deep.equal(['VideoObject', 'BreadcrumbList'])
  })

  it('walks Home to this page, every crumb with a target', () => {
    const [, crumbs] = jsonLdGraphs(buildSeoBody(PHOTO_BODY_OPTIONS))
    expect(crumbs.itemListElement.map((crumb) => crumb.position)).to.deep.equal([1, 2])
    expect(crumbs.itemListElement[0].name).to.equal('Home')
    expect(crumbs.itemListElement[0].item).to.equal('https://wisaw.com/')
    expect(crumbs.itemListElement[1].name).to.equal(PHOTO_BODY_OPTIONS.pageTitle)
    expect(crumbs.itemListElement[1].item).to.equal(`https://wisaw.com/photos/${ROUTE_ID}`)
    for (const crumb of crumbs.itemListElement) expect(crumb['@type']).to.equal('ListItem')
  })

  it('keeps the media graph rules unchanged', () => {
    const [graph] = jsonLdGraphs(buildSeoBody(VIDEO_BODY_OPTIONS))
    expect(graph.thumbnailUrl).to.equal(`https://img.wisaw.com/${THUMB_KEY}`)
    expect(graph.contentUrl).to.equal(`https://img.wisaw.com/${ROUTE_ID}.mp4`)
    expect(graph.duration).to.equal('PT48S')
  })

  it('escapes a hostile title inside the breadcrumb instead of closing the script', () => {
    const body = buildSeoBody({ ...PHOTO_BODY_OPTIONS, pageTitle: '</script><script>alert(1)</script>' })
    expect(countOf(body, /<script\b/gi)).to.equal(2)
    for (const graph of jsonLdGraphs(body)) expect(graph).to.be.an('object')
  })
})

describe('the skeleton through the real mount point', () => {
  function injectedFor (bodyOptions, headOverrides = {}) {
    const isVideo = bodyOptions.entityLabel === 'video'
    return injectMetaTags(SERVED_SHELL, {
      description: bodyOptions.description,
      metaDescription: bodyOptions.description,
      entityLabel: bodyOptions.entityLabel,
      ogType: isVideo ? 'video.other' : 'photo',
      pathSegment: bodyOptions.pathSegment,
      imageIdText: ROUTE_ID,
      imageIdUrl: ROUTE_ID,
      pageTitle: bodyOptions.pageTitle,
      videoUrl: bodyOptions.videoUrl || '',
      videoDuration: bodyOptions.duration ?? null,
      width: bodyOptions.width || '',
      height: bodyOptions.height || '',
      bodyHtml: buildSeoBody(bodyOptions),
      ...headOverrides
    })
  }

  it('keeps exactly one mount point and every script the shell boots with', () => {
    for (const options of [PHOTO_BODY_OPTIONS, VIDEO_BODY_OPTIONS]) {
      const html = injectedFor(options)
      expect(countOf(html, /<div\b[^>]*\bid=["']root["']/gi)).to.equal(1)
      // The client counts this literal; a second copy anywhere - even in a comment - breaks it.
      expect(countOf(html, /<div id="root">/g)).to.equal(1)
      expect(html).to.contain('type="module"')
      expect(html).to.contain('rel="stylesheet"')
      expect(html).to.contain('wisaw-reload-at')
      expect(countOf(html, /<script\b/gi)).to.equal(countOf(SERVED_SHELL, /<script\b/gi) + 2)
      expect(html.trim().endsWith('</html>')).to.equal(true)
    }
  })

  it('writes the skeleton inside the mount point and leaves the shell outside it alone', () => {
    const html = injectedFor(PHOTO_BODY_OPTIONS)
    const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('</div>\n</body>') + 6)
    expect(root).to.include('data-wisaw-media')
    expect(root).to.include('data-wisaw-slot="below"')
    expect(html).to.not.include('Unaltered Photos and Videos, Taken with Phone Cameras.')
    // Nothing in the body may spell out the mount point it lives in.
    expect(html.slice(html.indexOf('<div id="root">')).match(/id="root"/g)).to.have.lengthOf(1)
  })

  it('publishes no record field the old body did not', () => {
    // The skeleton takes more geometry from the sidecar than the bare block did; coordinates are
    // still never published, and an unknown option key cannot smuggle one in.
    const body = buildSeoBody({ ...PHOTO_BODY_OPTIONS, lat: '40.6833', lon: '-73.974', location: { latitude: 1, longitude: 2 } })
    expect(body).to.not.match(/40\.6833|73\.974|latitude|longitude/i)
  })

  it('keeps the SERP-visible copy identical to the pre-skeleton page', () => {
    const body = buildSeoBody(PHOTO_BODY_OPTIONS)
    expect(body).to.include(`<h1>${PHOTO_BODY_OPTIONS.pageTitle}</h1>`)
    expect(body).to.include(`<p>${PHOTO_BODY_OPTIONS.description}</p>`)
    expect(body).to.include('<a rel="tag" href="/search/pier">pier</a> <a rel="tag" href="/search/dusk">dusk</a>')
    expect(body).to.include('<nav><a href="/">WiSaw - free authentic stock photos and videos</a></nav>')
  })
})

describe('the fixture against the real client shell', () => {
  // tests/fixtures/served-index.html is a trimmed snapshot of WiSaw.client's index.html, kept in
  // step by hand (brief §5). When the client repo is checked out beside this one, pin the
  // boot-critical structure both files must share, so a fixture that drifted from the shell that
  // actually ships fails here instead of blessing a broken injection contract.
  const CLIENT_SHELL = process.env.WISAW_CLIENT_PATH || path.join(__dirname, '..', '..', 'WiSaw.client', 'index.html')
  const present = fs.existsSync(CLIENT_SHELL)

  if (!present) {
    // A skipped cross-repo pin is a contract nobody is checking, and "green" is the worst possible
    // result for that. One loud failure instead: name what did not run and how to make it run.
    it('the client-side pins below were NOT run', () => {
      throw new Error(`needs WiSaw.client/index.html to compare against; looked in ${CLIENT_SHELL}. ` +
        'Check the two repos out beside each other or set WISAW_CLIENT_PATH.')
    })
  } else {
    it('keeps one of each mount container, a module script and the reload guard in both files', () => {
      const shell = fs.readFileSync(CLIENT_SHELL, 'utf8')
      for (const [name, html] of [['fixture', SERVED_SHELL], ['client shell', shell]]) {
        // #root is what the injector rewrites; #wisaw-app is where React mounts. A fixture without
        // the second one blesses an injection contract against a document the app cannot boot in.
        expect(countOf(html, /<div\b[^>]*\bid=["']root["']/gi), `${name} #root`).to.equal(1)
        expect(countOf(html, /<div\b[^>]*\bid=["']wisaw-app["']/gi), `${name} #wisaw-app`).to.equal(1)
        expect(/<script\b[^>]*type="module"/i.test(html), name).to.equal(true)
        expect(html.includes('wisaw-reload-at'), `${name} reload guard`).to.equal(true)
      }
    })

    it('carries no boot marker the real shell does not have', () => {
      const shell = fs.readFileSync(CLIENT_SHELL, 'utf8')
      const shellMarkers = new Set(shell.match(/data-wisaw-[a-z-]+/g) || [])
      for (const marker of new Set(SERVED_SHELL.match(/data-wisaw-[a-z-]+/g) || [])) {
        expect(shellMarkers.has(marker), marker).to.equal(true)
      }
    })
  }
})
