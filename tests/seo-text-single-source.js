/* eslint-env node */
/* global require, describe, it */

// Ticket 6: SEO text is produced ONCE, in the record that both surfaces read.
//
// The defect this pins out of existence: the edge reader and the writer each kept their own copy of
// the word budgets, the month format and the truncation rule, so a page's <title> in the crawler's
// first byte did not match the same page after the SPA hydrated - and Google Image Search showed a
// third variant. Every test below compares two surfaces that used to drift.

const { expect } = require('chai')

const rules = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoRules.js')
const edgeText = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoText.js')
const writer = require('../lambda-fns/utilities/seoSidecar.ts')

const ID = '35e99e0c-03a1-4f30-80d3-405bc1f3df35'

function photoRow (overrides) {
  return Object.assign({
    id: ID,
    lastComment: 'Golden retriever chasing a ball at sunset',
    labels: ['Dog', 'Beach', 'Sunset', 'Ball'],
    locality: 'Coney Island',
    district: 'Brooklyn',
    region: 'New York',
    createdAt: new Date('2025-09-14T18:30:00.000Z'),
    width: '4032',
    height: '3024',
    video: false
  }, overrides)
}

describe('SEO text - one set of rules, one record, every surface', () => {
  it('the writer and the edge load THE SAME functions, not copies of them', () => {
    // Identity, not equal output: two implementations that agree today drift tomorrow.
    expect(writer.truncateWords).to.equal(rules.truncateWords)
    expect(writer.splitImageText).to.equal(rules.splitImageText)
    expect(writer.monthYear).to.equal(rules.monthYear)
    expect(writer.locationText).to.equal(rules.locationText)
    expect(writer.pickLabels).to.equal(rules.pickLabels)
  })

  it('the record carries finished strings for the media it describes', () => {
    const record = writer.buildSeoSidecar(photoRow())
    expect(record.seo).to.be.an('object')
    expect(record.seo.kind).to.equal('photo')
    expect(record.seo.title).to.be.a('string').with.length.greaterThan(0)
    expect(record.seo.description).to.be.a('string').with.length.greaterThan(0)
    expect(record.seo.imageTitle).to.contain('Dog')
    expect(record.seo.imageCaption).to.contain('Golden retriever')
  })

  it('a video row gets video strings, so a photo title can never wear a video URL', () => {
    const record = writer.buildSeoSidecar(photoRow({ video: true }))
    expect(record.seo.kind).to.equal('video')
    expect(record.seo.title).to.contain('video')
  })

  it('the strings stored in a record are byte-identical to what the shared rules derive from it', () => {
    const record = writer.buildSeoSidecar(photoRow())
    // A record written before this change has no `seo` key. Rendering that one must produce exactly
    // what the new one stores, which is why records can be backfilled at leisure instead of in
    // lockstep with a deploy.
    const withoutStrings = Object.assign({}, record)
    delete withoutStrings.seo

    const derived = rules.buildSeoFields({ sidecar: withoutStrings, entityLabel: 'photo', imageIdText: ID })
    expect(record.seo.title).to.equal(derived.pageTitle)
    expect(record.seo.description).to.equal(derived.metaDescription)
    expect(record.seo.imageTitle).to.equal(derived.imageTitle)
    expect(record.seo.imageCaption).to.equal(derived.imageCaption)
  })

  it('the edge renders the stored strings instead of composing its own', () => {
    const record = writer.buildSeoSidecar(photoRow())
    const served = edgeText.buildSeoFields({ sidecar: record, entityLabel: 'photo', imageIdText: ID })

    expect(served.pageTitle).to.equal(record.seo.title)
    expect(served.metaDescription).to.equal(record.seo.description)
    // <title> and og:title are the same string on both surfaces; the app renders these bytes too.
    expect(served.pageTitle).to.contain('Golden retriever')
    expect(served.pageTitle).to.match(/· WiSaw$/)
  })

  it('the edge does not re-truncate text the record already finished', () => {
    // A record whose stored title is longer than the page budget proves the edge passes it through.
    // Re-truncating here is how one page ends up with two titles.
    const long = 'A caption that goes on for a while and is definitely longer than the sixty eight character page budget'
    const record = Object.assign(writer.buildSeoSidecar(photoRow()), { seo: { kind: 'photo', title: long, description: long, imageTitle: long, imageCaption: long } })
    const served = edgeText.buildSeoFields({ sidecar: record, entityLabel: 'photo', imageIdText: ID })

    expect(served.pageTitle).to.equal(long)
    expect(served.metaDescription).to.equal(long)
  })

  it('an empty stored string falls back to the derived text rather than publishing a blank title', () => {
    const record = Object.assign(writer.buildSeoSidecar(photoRow()), { seo: { kind: 'photo', title: '   ', description: '' } })
    const served = edgeText.buildSeoFields({ sidecar: record, entityLabel: 'photo', imageIdText: ID })
    const derived = rules.buildSeoFields({ sidecar: record, entityLabel: 'photo', imageIdText: ID })

    expect(served.pageTitle).to.equal(derived.pageTitle)
    expect(served.metaDescription).to.equal(derived.metaDescription)
  })

  it('a record of the wrong kind is derived for, never borrowed', () => {
    const photoRecord = writer.buildSeoSidecar(photoRow())
    const served = edgeText.buildSeoFields({ sidecar: photoRecord, entityLabel: 'video', imageIdText: ID })

    expect(served.pageTitle).to.not.equal(photoRecord.seo.title)
    expect(served.pageTitle).to.contain('video')
  })

  it('both stacks cut at word boundaries through the one truncation rule', () => {
    const long = 'Golden retriever chasing a ball at sunset along the promenade while gulls circle overhead'
    const cut = rules.truncateWords(long, 40)

    expect(cut.length).to.be.at.most(40)
    expect(cut).to.equal(`${long.slice(0, long.lastIndexOf(' ', 39))}…`)
    // The sitemap slot uses the same rule, so a title never reads whole in one surface and chopped
    // mid-word in another.
    const pair = rules.splitImageText(photoRow({ lastComment: long, labels: [long] }), 'photo')
    expect(pair.title).to.not.match(/[a-z]…$/)
  })

  it('the capture month is formatted once, and both surfaces say the same thing', () => {
    const record = writer.buildSeoSidecar(photoRow())
    const derived = rules.buildSeoFields({ sidecar: Object.assign({}, record, { seo: undefined }), entityLabel: 'photo', imageIdText: ID })

    expect(record.seo.description).to.contain('Captured Sep 2025')
    expect(derived.metaDescription).to.equal(record.seo.description)
    expect(rules.monthYear('2025-09-14T18:30:00.000Z')).to.equal('Sep 2025')

    // Where the place is short enough for the rich suffix, the month reaches the title too - and it
    // reads "Sep 2025" there, not "Sept. 2025"/"Sep, 2025", because exactly one formatter exists.
    const titled = writer.buildSeoSidecar(photoRow({ locality: 'NYC', district: '', region: '' }))
    expect(titled.seo.title).to.contain('Sep 2025')
  })

  it('the same first three tags fill every slot that lists tags', () => {
    const record = writer.buildSeoSidecar(photoRow({ labels: ['Dog', 'Beach', 'Sunset', 'Ball', 'Ocean'] }))
    expect(record.seo.imageTitle).to.equal('Dog, Beach, Sunset')

    const served = edgeText.buildSeoFields({ sidecar: record, entityLabel: 'photo', imageIdText: ID })
    expect(served.labels.slice(0, rules.TAG_TITLE_LIMIT)).to.deep.equal(['Dog', 'Beach', 'Sunset'])
    expect(served.metaDescription).to.contain('Dog, Beach, Sunset')
  })

  it('nothing is invented when a record has no comment, tags or place', () => {
    const bare = writer.buildSeoSidecar({ id: ID, labels: [], createdAt: null, video: false })

    // The id keeps an un-enriched page unique instead of sharing one generic title with thousands.
    expect(bare.seo.title).to.equal(`wisaw photo ${ID}`)
    expect(bare.seo.imageCaption).to.equal('')
    expect(bare.created).to.equal('')
  })
})
