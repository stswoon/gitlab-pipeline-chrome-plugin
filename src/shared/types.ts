export type ParamType = 'variable' | 'input' | 'branch'

export type ProfileParam = {
  id: string
  type: ParamType
  name: string
  value: string
}

export type Profile = {
  id: string
  name: string
  params: ProfileParam[]
}

export type StorageShape = {
  profiles: Profile[]
  currentProfileId: string
}
