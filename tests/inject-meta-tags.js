/* eslint-env node */
const { expect } = require('chai')
const { describe, it } = require('mocha')

const { injectMetaTags, stripExistingMetaTags } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils')

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
  <link rel='canonical' href="https://wisaw.com" data-rh="true"/>
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
<body></body>
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

describe('stripExistingMetaTags', () => {
  it('strips og:image tag', () => {
    const html = '<meta property="og:image" content="https://example.com/logo.png" data-rh="true" />'
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
