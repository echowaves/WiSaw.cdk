/* eslint-env node */
/* global require, exports, process */
const { sanitizeImageId, injectMetaTags, buildSeoBody, htmlResponse, renderNotFoundDocument } = require('./utils')
const { parseMediaUri } = require('./mediaUri')
const { fetchShell } = require('./template')
const { fetchSidecar } = require('./sidecar')
const { buildSeoFields } = require('./seoText')
const { probeMedia } = require('./media')

const IMG_BUCKET = process.env.WISAW_IMG_BUCKET || 'wisaw-img-prod'
const FALLBACK_DESCRIPTION = 'Free unaltered photo on WiSaw - authentic photos and videos taken with phone cameras.'

exports.handler = async (event, context, callback) => {
  const { request } = event.Records[0].cf
  const parsed = parseMediaUri(request.uri)

  // Anything that is not exactly /photos/<uuid> is not a photo page. Answering it with
  // the SPA used to mint an indexable duplicate per typo (/photos/ABC/, /photos/x/full,
  // uppercase ids), each declaring itself the canonical original.
  if (!parsed.valid) {
    return callback(null, htmlResponse(404, renderNotFoundDocument('photo'), { noindex: true, cacheControl: 'max-age=86400' }))
  }

  const { text: imageIdText, url: imageIdUrl, raw: imageIdRaw } = sanitizeImageId(`/${parsed.kind}/${parsed.id}`)

  const [sidecar, media] = await Promise.all([
    fetchSidecar(imageIdRaw),
    probeMedia(IMG_BUCKET, imageIdRaw)
  ])

  // Dead ids used to answer 200 with the SPA shell (soft 404). A real 404 + noindex tells
  // Google the URL is gone and stops it re-crawling deleted photos forever. probeMedia only
  // reports "gone" on a definitive empty listing, never on a permission error.
  if (!media.exists) {
    return callback(null, htmlResponse(404, renderNotFoundDocument('photo'), { noindex: true, cacheControl: 'max-age=86400' }))
  }

  const seo = buildSeoFields({
    sidecar,
    entityLabel: 'photo',
    imageIdText,
    lastModified: media.lastModified
  })

  const description = seo.metaDescription || FALLBACK_DESCRIPTION
  const index = await fetchShell()

  const seoBody = buildSeoBody({
    entityLabel: 'photo',
    pathSegment: 'photos',
    imageIdText,
    pageTitle: seo.pageTitle,
    description,
    caption: seo.caption,
    labels: seo.labels,
    created: seo.created,
    width: seo.width,
    height: seo.height
  })

  const body = injectMetaTags(index, {
    description,
    metaDescription: description,
    entityLabel: 'photo',
    ogType: 'photo',
    pathSegment: 'photos',
    imageIdText,
    imageIdUrl,
    pageTitle: seo.pageTitle,
    created: seo.created,
    width: seo.width,
    height: seo.height,
    bodyHtml: seoBody
  })

  // Longer TTL than before: photo records are immutable, and the crawler directives and
  // canonical for a given id never change, so a stale copy costs nothing while every miss
  // costs an S3 shell read plus a sidecar read.
  return callback(null, htmlResponse(200, body))
}
