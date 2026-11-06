/* eslint-env node */
/* global require, exports */
const { injectRouteTags, htmlResponse } = require('./utils')
const { fetchShell } = require('./template')

// Head tags for the routes that are not photo/video pages. They were served raw from S3,
// so the homepage had no canonical at all and /about, /contact and /terms all wore the
// homepage <title> - four URLs that look like copies of one document. Search results are
// marked noindex because every search term is a machine-made page with no content of its
// own, which is the classic doorway pattern.
const ROUTES = {
  '/': {
    title: 'Free Stock Photos & Videos, Unaltered | WiSaw',
    description: 'Free stock photos and videos, unaltered and royalty free, taken with phone cameras. Browse recent shots and search by what is in them.',
    canonical: 'https://wisaw.com/',
    noindex: false
  },
  '/about': {
    title: 'About WiSaw — unaltered photos and videos from phone cameras',
    description: 'WiSaw publishes unaltered photos and videos taken with phone cameras: no staging, no studio lighting, no copyright traps. What the app is and why it exists.',
    canonical: 'https://wisaw.com/about',
    noindex: false
  },
  '/contact': {
    title: 'Contact WiSaw',
    description: 'Contact WiSaw: report a photo or video, request removal, ask about licensing, or send product feedback.',
    canonical: 'https://wisaw.com/contact',
    noindex: false
  },
  '/terms': {
    title: 'Terms and Conditions — WiSaw',
    description: 'The terms that apply to wisaw.com and the WiSaw apps, including what you may do with photos and videos published on the platform.',
    canonical: 'https://wisaw.com/terms',
    noindex: false
  },
  '/search': {
    title: 'Search WiSaw — free unaltered photos and videos',
    description: 'Search several thousand unaltered photos and videos taken with phone cameras by what appears in them.',
    canonical: 'https://wisaw.com/search',
    noindex: true
  }
}

function routeFor (uri = '') {
  // CloudFront rewrites / to the distribution's default root object before origin-request.
  if (uri === '/' || uri === '/index.html') return ROUTES['/']
  const path = uri.replace(/\/+$/, '') || '/'
  if (ROUTES[path]) return ROUTES[path]
  // /search/<term> and friends: the first segment decides the route.
  const head = `/${String(path).split('/')[1] || ''}`
  return ROUTES[head] || null
}

exports.handler = async (event, context, callback) => {
  const { request } = event.Records[0].cf
  const route = routeFor(request.uri)

  // A behaviour we do not recognise is passed through untouched rather than answered with
  // the homepage head, which would create another set of duplicate documents.
  if (!route) return callback(null, request)

  const index = await fetchShell()
  const body = injectRouteTags(index, {
    title: route.title,
    description: route.description,
    canonical: route.canonical
  })

  return callback(null, htmlResponse(200, body, {
    noindex: route.noindex,
    cacheControl: route.noindex ? 'private, no-cache' : 'max-age=900'
  }))
}
