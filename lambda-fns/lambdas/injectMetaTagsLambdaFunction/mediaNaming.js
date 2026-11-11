/* eslint-env node */
/* global module */

// Single source of truth for what a stored media object is called.
//
// Three surfaces used to spell this rule out by hand: the sitemap generator, the edge head
// injector and the API's photo model. Only the injector ever looked at storage, so the two that
// did not simply guessed `<id>.mov`. That guess publishes a sitemap entry for an object that was
// never written the first time a video is stored under another extension — which is exactly the
// case `media.js` defends against when it probes a page.
//
// This file sits inside the injector folder rather than `lambda-fns/utilities/` because the three
// injector functions are deployed with `Code.fromAsset(<this folder>)`: a raw zip, no bundler, so
// anything they load has to live here (see `lib/resources/lambdas.ts`). The esbuild-bundled
// TypeScript side imports it from this path rather than keeping its own copy — one module, both
// builds, nothing generated or duplicated.

const VIDEO_EXTENSIONS = ['mov', 'mp4', 'webm', 'm4v']
const VIDEO_EXT_RE = new RegExp('\\.(' + VIDEO_EXTENSIONS.join('|') + ')$', 'i')
const IMAGE_EXTENSION = 'webp'
const THUMB_SUFFIX = '-thumb'
const IMG_HOST = 'https://img.wisaw.com'

function isVideoObjectKey (key = '') {
  return VIDEO_EXT_RE.test(String(key))
}

function isThumbnailObjectKey (key = '') {
  return String(key).endsWith(`${THUMB_SUFFIX}.${IMAGE_EXTENSION}`)
}

/** The `<id>.json` SEO sidecar: never media, and its mtime must not date a page. */
function isSidecarObjectKey (key = '') {
  return String(key).endsWith('.json')
}

function isImageObjectKey (key = '') {
  return String(key).endsWith(`.${IMAGE_EXTENSION}`) && !isThumbnailObjectKey(key)
}

/**
 * The video object for an id, given whatever the caller learned from storage.
 * `resolvedKey` wins when it really is a video object; otherwise the first extension in
 * VIDEO_EXTENSIONS is the documented fallback, so callers always publish a well-formed key.
 */
function videoObjectKey (id = '', resolvedKey = '') {
  const key = String(resolvedKey || '')
  if (isVideoObjectKey(key)) return key
  return `${id}.${VIDEO_EXTENSIONS[0]}`
}

/**
 * Choose between several stored objects for one id deterministically.
 * Both the edge probe and the sitemap generator call this so a page head and its sitemap entry
 * can never name different files; listing order from S3 is lexicographic, which would otherwise
 * decide it by accident (`.m4v` before `.mov`).
 */
function pickVideoObjectKey (id = '', keys = []) {
  for (const ext of VIDEO_EXTENSIONS) {
    const candidate = `${id}.${ext}`
    if (keys.some((k) => k === candidate)) return candidate
  }
  // Nothing recognised: publish the object that is actually there rather than a file that is not,
  // skipping the thumbnail and the sidecar, which are never playable media.
  const found = keys.find((key) => !isImageObjectKey(key) && !isThumbnailObjectKey(key) && !isSidecarObjectKey(key))
  return found || videoObjectKey(id)
}

function imageObjectKey (id = '') {
  return `${id}.${IMAGE_EXTENSION}`
}

function thumbnailObjectKey (id = '') {
  return `${id}${THUMB_SUFFIX}.${IMAGE_EXTENSION}`
}

function imgUrl (key = '') {
  return `${IMG_HOST}/${String(key).replace(/^\/+/, '')}`
}

module.exports = {
  VIDEO_EXTENSIONS,
  IMAGE_EXTENSION,
  THUMB_SUFFIX,
  IMG_HOST,
  isVideoObjectKey,
  isImageObjectKey,
  isSidecarObjectKey,
  isThumbnailObjectKey,
  videoObjectKey,
  pickVideoObjectKey,
  imageObjectKey,
  thumbnailObjectKey,
  imgUrl
}
