export class Wave {
  waveUuid: string
  name: string
  description: string
  createdBy: string
  freezeMode: 'AUTO' | 'FROZEN' | 'UNFROZEN'
  location: object
  radius: number
  photos: any[]
  photosCount: number
  open: boolean
  splashDate: string
  freezeDate: string
  isFrozen: boolean
  myRole: string
  joinUrl: string | null
  createdAt: string
  updatedAt: string
}
