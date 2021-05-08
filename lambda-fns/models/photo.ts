type Photo = {
  id: bigint
  uuid: string
  location: object
  likes: bigint
  commentsCount: bigint
  createdAt: string
  updatedAt: string
  active: boolean
  imgUrl: string
  thumbUrl: string
}

export default Photo
