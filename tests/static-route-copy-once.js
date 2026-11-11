/* eslint-env node */
const { expect } = require('chai')
const { describe, it } = require('mocha')
const fs = require('fs')

const utils = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils')
const staticRoute = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/static')
const { renderStaticSeoModule, TARGET } = require('../scripts/publish-static-seo')

const SERVED_SHELL = fs.readFileSync(require('path').join(__dirname, 'fixtures', 'served-index.html'), 'utf8')

function countOf (text, pattern) {
  return (text.match(pattern) || []).length
}

/** The five head values both readers publish; anything else in a table entry is plumbing. */
function pick (head) {
  return { title: head.title, description: head.description, canonical: head.canonical, image: head.image, noindex: head.noindex }
}

/** A template left behind by an older deploy: the three properties, none of them marked. */
const STALE_TEMPLATE = `<!DOCTYPE html><html><head>
<title>Old title</title>
<meta property="og:site_name" content="What I Saw" />
<meta property="og:locale" content="fr_FR" />
<meta name="robots" content="index, follow" />
</head><body><div id="root"></div></body></html>`

describe('static-route copy is authored once and published to both sides', () => {
  describe('the edge owns site name, locale and robots (criterion 5)', () => {
    it('removes stale copies from an older template', () => {
      const stripped = utils.stripExistingMetaTags(STALE_TEMPLATE)
      expect(stripped).to.not.contain('og:site_name')
      expect(stripped).to.not.contain('og:locale')
      expect(stripped).to.not.contain('name="robots"')
    })

    it('injects exactly one locale into a media head, marked for the app', () => {
      const html = utils.injectMetaTags(SERVED_SHELL, {
        description: 'A dog on the sand',
        entityLabel: 'photo',
        ogType: 'photo',
        pathSegment: 'photos',
        imageIdText: 'abc-123',
        imageIdUrl: 'abc-123'
      })
      expect(countOf(html, /property="og:locale"/g)).to.equal(1)
      expect(html).to.contain(`og:locale" content="${utils.LOCALE}" data-rh="true"`)
    })

    it('injects exactly one locale into a route head', () => {
      const html = utils.injectRouteTags(SERVED_SHELL, staticRoute.headFor('/about'))
      expect(countOf(html, /property="og:locale"/g)).to.equal(1)
      expect(countOf(html, /property="og:site_name"/g)).to.equal(1)
      expect(countOf(html, /name="robots"/g)).to.equal(1)
    })
  })

  describe('static routes publish their own share image', () => {
    it('adds og:image and the Twitter pair the app already declares', () => {
      const html = utils.injectRouteTags(SERVED_SHELL, staticRoute.headFor('/about'))
      expect(countOf(html, /property="og:image"/g)).to.equal(1)
      expect(html).to.contain('content="https://wisaw.com/android-chrome-512x512.png"')
      expect(countOf(html, /name="twitter:card"/g)).to.equal(1)
      expect(html).to.contain('name="twitter:title" content="About WiSaw')
      expect(countOf(html, /name="twitter:image"/g)).to.equal(1)
    })

    it('leaves the template without a canonical alone only when the route has none', () => {
      const html = utils.injectRouteTags(SERVED_SHELL, staticRoute.headFor('/contact'))
      expect(countOf(html, /rel="canonical"/g)).to.equal(1)
      expect(html).to.contain('href="https://wisaw.com/contact" data-rh="true"')
    })
  })

  describe('search results keep their exclusion and stop collapsing (criterion 3)', () => {
    it('serves the term its own canonical, title and description', () => {
      const head = staticRoute.headFor('/search/new%20york')
      expect(head.title).to.equal('WiSaw: searching for new york')
      expect(head.description).to.equal('WiSaw: searching for new york')
      expect(head.canonical).to.equal('https://wisaw.com/search/new%20york')
      expect(head.noindex).to.equal(true)
    })

    it('survives a term that is not valid percent-encoding', () => {
      const head = staticRoute.headFor('/search/100%25')
      expect(head.title).to.equal('WiSaw: searching for 100%')
      expect(staticRoute.headFor('/search/100%zz').title).to.equal('WiSaw: searching for 100%zz')
    })

    it('keeps the bare search page on its own copy', () => {
      const head = staticRoute.headFor('/search')
      expect(head.canonical).to.equal('https://wisaw.com/search')
      expect(head.title).to.equal(staticRoute.ROUTES['/search'].title)
    })

    it('says noindex in the body and in the header for every search URL', () => {
      for (const uri of ['/search', '/search/dog']) {
        const html = utils.injectRouteTags(SERVED_SHELL, staticRoute.headFor(uri))
        expect(html).to.contain(`name="robots" content="${utils.ROBOTS_NOINDEX}" data-rh="true"`)
        const response = utils.htmlResponse(200, html, { noindex: true })
        const headers = JSON.stringify(response.headers || [])
        expect(headers).to.contain('X-Robots-Tag')
        expect(headers).to.contain('noindex')
      }
    })

    it('passes an unknown behaviour through untouched', () => {
      expect(staticRoute.headFor('/totally-unknown')).to.equal(null)
      expect(staticRoute.routeFor('/totally-unknown')).to.equal(null)
    })
  })

  describe('the copy the app publishes is this table (criterion 2)', () => {
    const committed = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : null

    it('is committed in the app repository', function () {
      if (committed === null) {
        // The sibling checkout is not present; nothing to compare against here.
        this.skip()
      }
      expect(committed).to.contain('GENERATED')
    })

    it('matches the route table byte for byte', function () {
      if (committed === null) this.skip()
      expect(committed).to.equal(renderStaticSeoModule())
    })

    it('carries every shared constant the app mirrors', function () {
      if (committed === null) this.skip()
      for (const [name, value] of Object.entries({
        SITE_NAME: utils.SITE_NAME,
        LOCALE: utils.LOCALE,
        ROBOTS_INDEX: utils.ROBOTS_INDEX,
        ROBOTS_NOINDEX: utils.ROBOTS_NOINDEX,
        TWITTER_CARD: utils.TWITTER_CARD
      })) {
        expect(committed).to.contain(`export const ${name} = ${JSON.stringify(value)}`)
      }
    })

    it('gives the app a lookup that answers exactly like this edge', function () {
      if (committed === null) this.skip()
      // Evaluate the published module as CommonJS: an unexported or renamed helper would leave
      // the app importing `undefined` and quietly rendering no head at all.
      const source = renderStaticSeoModule()
        .replace(/^export const /gm, 'const ')
        .replace('export function staticHead', 'function staticHead') +
        '\nmodule.exports = { staticHead, STATIC_ROUTES }'
      const box = { exports: {} }
      new Function('module', source)(box)
      const { staticHead } = box.exports

      for (const path of ['/', '/about', '/contact', '/terms', '/search']) {
        expect(staticHead(path), path).to.deep.equal(pick(staticRoute.headFor(path)))
      }
      // The term reaches both sides the same way: decoded in the app, encoded in the canonical.
      expect(staticHead('/search', 'new york')).to.deep.equal(pick(staticRoute.headFor('/search/new%20york')))
      expect(staticHead('/photos/777')).to.equal(null)
    })

    it('ships the four branded pages with wording of their own', () => {
      for (const path of ['/', '/about', '/contact', '/terms']) {
        const head = staticRoute.headFor(path)
        expect(head.title, path).to.be.a('string').with.length.greaterThan(10)
        expect(head.description, path).to.be.a('string').with.length.greaterThan(40)
        expect(head.canonical, path).to.match(/^https:\/\/wisaw\.com/)
        expect(head.noindex, path).to.equal(false)
      }
    })
  })
})
