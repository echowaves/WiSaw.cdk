/* eslint-env node */
/* global require, exports */
const { injectRouteTags, htmlResponse } = require('./utils')
const { fetchShell } = require('./template')

// Head tags for the routes that are not photo/video pages. They were served raw from S3,
// so the homepage had no canonical at all and /about, /contact and /terms all wore the
// homepage <title> - four URLs that look like copies of one document. Search results are
// marked noindex because every search term is a machine-made page with no content of its
// own, which is the classic doorway pattern.
// The brand picture, used where a route has no per-page representative image. It is the same
// file the app publishes on these pages, so the crawler's copy and the browser's agree.
const BRAND_IMAGE = 'https://wisaw.com/android-chrome-512x512.png'

// This table is the authored copy for the static routes: scripts/publish-static-seo.js renders it
// into WiSaw.client/src/utils/staticSeo.generated.js, so a page's wording exists once and reaches
// both the first byte and the hydrated document. Edit here, then run that script.
const ROUTES = {
  '/': {
    title: 'Free Stock Photos & Videos, Unaltered | WiSaw',
    description: 'Free stock photos and videos, unaltered and royalty free, taken with phone cameras. Browse recent shots and search by what is in them.',
    canonical: 'https://wisaw.com/',
    image: BRAND_IMAGE,
    noindex: false
  },
  '/about': {
    title: 'About WiSaw — unaltered photos and videos from phone cameras',
    description: 'WiSaw publishes unaltered photos and videos taken with phone cameras: no staging, no studio lighting, no copyright traps. What the app is and why it exists.',
    canonical: 'https://wisaw.com/about',
    image: BRAND_IMAGE,
    noindex: false
  },
  '/contact': {
    title: 'Contact WiSaw',
    description: 'Contact WiSaw: report a photo or video, request removal, ask about licensing, or send product feedback.',
    canonical: 'https://wisaw.com/contact',
    image: BRAND_IMAGE,
    noindex: false
  },
  '/terms': {
    title: 'Terms and Conditions — WiSaw',
    description: 'The terms that apply to wisaw.com and the WiSaw apps, including what you may do with photos and videos published on the platform.',
    canonical: 'https://wisaw.com/terms',
    image: BRAND_IMAGE,
    noindex: false
  },
  '/search': {
    title: 'Search WiSaw — free unaltered photos and videos',
    description: 'Search several thousand unaltered photos and videos taken with phone cameras by what appears in them.',
    canonical: 'https://wisaw.com/search',
    image: BRAND_IMAGE,
    noindex: true,
    // A search-results URL is machine-made, so its copy is a template with the term inserted.
    // `{term}` is the only placeholder; both sides substitute it the same way, which is what keeps
    // the first byte and the hydrated head identical for one term.
    titleTerm: 'WiSaw: searching for {term}',
    descriptionTerm: 'WiSaw: searching for {term}',
    canonicalTerm: 'https://wisaw.com/search/{term}'
  }
}

function decodeTerm (raw = '') {
  if (!raw) return ''
  // A stray percent sign in a search term is the user's text, not a decoding error.
  try { return decodeURIComponent(raw) } catch (err) { return raw }
}

/** Which route a URI belongs to, plus the decoded search term when the URI carries one. */
function parseUri (uri = '') {
  // CloudFront rewrites / to the distribution's default root object before origin-request.
  if (uri === '/' || uri === '/index.html') return { key: '/', term: '' }
  const path = String(uri).replace(/[?#].*$/, '').replace(/\/+$/, '') || '/'
  if (ROUTES[path]) return { key: path, term: '' }
  // /search/<term> and friends: the first segment decides the route.
  const segments = path.split('/')
  const head = `/${segments[1] || ''}`
  if (!ROUTES[head]) return { key: '', term: '' }
  return { key: head, term: decodeTerm(segments.slice(2).join('/')) }
}

/**
 * The head for one URI: the route's copy, with `{term}` filled in when the URL carries a search
 * term. Both sides of the contract build their text from these same templates.
 */
function headFor (uri = '') {
  const { key, term } = parseUri(uri)
  const route = ROUTES[key]
  if (!route) return null

  if (term !== '' && route.canonicalTerm) {
    const fill = (template = '') => String(template).replace(/\{term\}/g, term)
    return {
      title: fill(route.titleTerm),
      description: fill(route.descriptionTerm),
      canonical: String(route.canonicalTerm).replace('{term}', encodeURIComponent(term)),
      image: route.image,
      noindex: route.noindex
    }
  }

  return {
    title: route.title,
    description: route.description,
    canonical: route.canonical,
    image: route.image,
    noindex: route.noindex
  }
}

function routeFor (uri = '') {
  return ROUTES[parseUri(uri).key] || null
}

exports.handler = async (event, context, callback) => {
  const { request } = event.Records[0].cf
  const head = headFor(request.uri)

  // A behaviour we do not recognise is passed through untouched rather than answered with
  // the homepage head, which would create another set of duplicate documents.
  if (!head) return callback(null, request)

  const index = await fetchShell()
  const body = injectRouteTags(index, head)

  return callback(null, htmlResponse(200, body, {
    noindex: head.noindex,
    cacheControl: head.noindex ? 'private, no-cache' : 'max-age=900'
  }))
}

exports.ROUTES = ROUTES
exports.parseUri = parseUri
exports.headFor = headFor
exports.routeFor = routeFor
