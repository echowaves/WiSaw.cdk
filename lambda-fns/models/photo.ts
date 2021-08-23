class Photo {
  id: bigint
  uuid: string
  location: object
  commentsCount: bigint
  watchersCount: bigint
  createdAt: string
  updatedAt: string
  active: boolean
  video: boolean

  // add custom derived attributes to the object
  public toJSON()
	{
		return {
	     ...this,
       // imgUrl: `https://s3.amazonaws.com/${process.env.S3_BUCKET}/${this.id}`,
       // thumbUrl: `https://s3.amazonaws.com/${process.env.S3_BUCKET}/${this.id}-thumb`,
       imgUrl: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${this.id}`,
       thumbUrl: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${this.id}-thumb`,
       videoUrl: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${this.id}.video`,
		};
	}
}

export default Photo
