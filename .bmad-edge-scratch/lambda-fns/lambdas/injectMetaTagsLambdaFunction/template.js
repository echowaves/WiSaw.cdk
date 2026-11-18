/* eslint-env node */
/* global require, module, console */

// The app shell is a single S3 object read on every origin-request miss. It used to be
// fetched with no error handling: one failed GetObject (or an index.html uploaded with a
// bad canonical) turned all ~21k photo and video URLs into Lambda@Edge 5xx responses.
// This module caches the shell per edge location and always returns usable HTML.
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')

const SHELL_BUCKET = 'wisaw.com'
const SHELL_KEY = 'index.html'
const SHELL_TTL_MS = 60 * 1000

let cachedShell = null
let cachedAt = 0

// Minimal document used only when S3 cannot serve index.html. It carries the same SEO
// contract as the real shell (single <title>, canonical, root div) so a broken upload
// degrades page quality instead of taking the whole deep-link surface offline.
function fallbackShell () {
  return '<!DOCTYPE html><html lang="en" prefix="og: http://ogp.me/ns#"><head><meta charset="utf-8">' +
    '<title>WiSaw</title>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">' +
    '</head><body><div id="root"></div>' +
    '<script async src="/assets/index.js" type="module"></script></body></html>'
}

async function fetchShell () {
  const now = Date.now()
  if (cachedShell && now - cachedAt < SHELL_TTL_MS) return cachedShell

  try {
    const client = new S3Client({ region: 'us-east-1' })
    const { Body } = await client.send(
      new GetObjectCommand({ Bucket: SHELL_BUCKET, Key: SHELL_KEY })
    )
    const html = await Body.transformToString()
    if (html && html.includes('<title>')) {
      cachedShell = html
      cachedAt = now
      return html
    }
    console.error('index.html fetched without a <title>; using fallback shell')
  } catch (err) {
    console.error('Unable to fetch index.html shell:', err && err.message)
  }
  // Keep serving the last good shell if we have one; otherwise the static fallback.
  return cachedShell || fallbackShell()
}

module.exports = { fetchShell, fallbackShell }
