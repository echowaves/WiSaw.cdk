// Same naming rule the sitemap generator and the edge head use, so an API response can never
// advertise a media file that the page or the sitemap disagrees with. See the note in
// lambdas/injectMetaTagsLambdaFunction/mediaNaming.js about why the shared module lives there.
import { imageObjectKey, thumbnailObjectKey, videoObjectKey } from '../lambdas/injectMetaTagsLambdaFunction/mediaNaming'

class Photo {
  id: string
  uuid: string
  location: object
  commentsCount: bigint
  watchersCount: bigint
  createdAt: string
  updatedAt: string
  active: boolean
  video: boolean
  width?: number
  height?: number
  locality: string | null
  district: string | null
  region: string | null
  country: string | null
  countryCode: string | null
  lastComment: string | null
  // add custom derived attributes to the object
  public toJSON() {
    return {
      ...this,
      // imgUrl: `https://s3.amazonaws.com/${process.env.S3_BUCKET}/${this.id}`,
      // thumbUrl: `https://s3.amazonaws.com/${process.env.S3_BUCKET}/${this.id}-thumb`,
      imgUrl: `https://${process.env.S3_IMAGES}/${imageObjectKey(this.id)}`,
      thumbUrl: `https://${process.env.S3_IMAGES}/${thumbnailObjectKey(this.id)}`,
      // The API has no storage lookup, so this is the documented fallback rather than a guess it
      // cannot verify; the edge head and the sitemap resolve the real object when they look.
      videoUrl: `https://${process.env.S3_IMAGES}/${videoObjectKey(this.id)}`,
    }
  }
}

export default Photo
