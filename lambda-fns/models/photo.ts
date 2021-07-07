class Photo {
  id: bigint
  uuid: string
  location: object
  likes: bigint
  commentsCount: bigint
  createdAt: string
  updatedAt: string
  active: boolean

  // add custom derived attributes to the object
  public toJSON()
	{
		return {
	     ...this,
       imgUrl: `https://s3.amazonaws.com/${process.env.S3_BUCKET}/${this.id}`,
       thumbUrl: `https://s3.amazonaws.com/${process.env.S3_BUCKET}/${this.id}-thumb`,
		};
	}
}

export default Photo
