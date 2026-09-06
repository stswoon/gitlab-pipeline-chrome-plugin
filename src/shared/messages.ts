import type { ProfileParam } from './types'

export const MSG_READ_FROM_PAGE = 'READ_FROM_PAGE' as const

export type ReadFromPageRequest = {
  type: typeof MSG_READ_FROM_PAGE
}

export type ReadFromPageResponse =
  | { ok: true; params: ProfileParam[] }
  | { ok: false; reason: 'not-pipeline-page' | 'unavailable' }
