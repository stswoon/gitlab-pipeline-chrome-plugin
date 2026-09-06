import { create } from 'zustand'
import {
  MSG_READ_FROM_PAGE,
  type ReadFromPageRequest,
  type ReadFromPageResponse,
} from '@/shared/messages'
import { parseQuery, serializeParams } from '@/shared/query'
import type { ParamType, Profile, ProfileParam, StorageShape } from '@/shared/types'
import { buildApplyUrl } from '@/shared/url'
import { STATUS } from './status'

export type EditorView = 'list' | 'bulk'

export type StatusTone = 'info' | 'error'

export type StatusState = {
  tone: StatusTone
  text: string
} | null

type Busy = 'idle' | 'applying' | 'reading'

type ParamPatch = Partial<Pick<ProfileParam, 'type' | 'name' | 'value'>>

export type PopupStore = {
  hydrated: boolean
  profiles: Profile[]
  currentProfileId: string
  view: EditorView
  bulkDraft: string
  status: StatusState
  busy: Busy
  hydrate: () => Promise<void>
  selectProfile: (id: string) => void
  addProfile: () => void
  renameProfile: (name: string) => boolean
  deleteCurrentProfile: () => boolean
  addParam: () => void
  updateParam: (paramId: string, patch: ParamPatch) => void
  removeParam: (paramId: string) => void
  setView: (view: EditorView) => void
  setBulkDraft: (text: string) => void
  applyToTab: () => Promise<void>
  readFromPage: () => Promise<void>
}

function createId(): string {
  return crypto.randomUUID()
}

function createEmptyProfile(name: string): Profile {
  return {
    id: createId(),
    name,
    params: [],
  }
}

export function createDefaultStorage(): StorageShape {
  const profile = createEmptyProfile('Profile 1')
  return {
    profiles: [profile],
    currentProfileId: profile.id,
  }
}

export function nextProfileName(profiles: Profile[]): string {
  const used = new Set<number>()
  for (const profile of profiles) {
    const match = /^Profile (\d+)$/.exec(profile.name)
    if (match?.[1]) {
      used.add(Number(match[1]))
    }
  }
  let n = 1
  while (used.has(n)) {
    n += 1
  }
  return `Profile ${n}`
}

function isParamType(value: unknown): value is ParamType {
  return value === 'variable' || value === 'input' || value === 'branch'
}

function isProfileParam(value: unknown): value is ProfileParam {
  if (!value || typeof value !== 'object') {
    return false
  }
  const param = value as Record<string, unknown>
  return (
    typeof param.id === 'string' &&
    isParamType(param.type) &&
    typeof param.name === 'string' &&
    typeof param.value === 'string'
  )
}

function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') {
    return false
  }
  const profile = value as Record<string, unknown>
  return (
    typeof profile.id === 'string' &&
    typeof profile.name === 'string' &&
    Array.isArray(profile.params) &&
    profile.params.every(isProfileParam)
  )
}

function normalizeStorage(raw: Record<string, unknown>): StorageShape {
  if (!Array.isArray(raw.profiles) || !raw.profiles.every(isProfile) || raw.profiles.length === 0) {
    return createDefaultStorage()
  }
  const profiles = raw.profiles
  const currentId = typeof raw.currentProfileId === 'string' ? raw.currentProfileId : ''
  const current = profiles.find((profile) => profile.id === currentId) ?? profiles[0]
  if (!current) {
    return createDefaultStorage()
  }
  return {
    profiles,
    currentProfileId: current.id,
  }
}

function canUseStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

function canUseTabs(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.tabs)
}

function writeStorage(shape: StorageShape) {
  if (!canUseStorage()) {
    return
  }
  void chrome.storage.local.set(shape)
}

function findProfile(profiles: Profile[], id: string): Profile | undefined {
  return profiles.find((profile) => profile.id === id)
}

function mapCurrent(
  profiles: Profile[],
  currentProfileId: string,
  updater: (profile: Profile) => Profile,
): Profile[] {
  return profiles.map((profile) =>
    profile.id === currentProfileId ? updater(profile) : profile,
  )
}

function hasBranch(params: ProfileParam[], exceptId?: string): boolean {
  return params.some((param) => param.type === 'branch' && param.id !== exceptId)
}

function isReadResponse(value: unknown): value is ReadFromPageResponse {
  if (!value || typeof value !== 'object') {
    return false
  }
  const response = value as Record<string, unknown>
  if (response.ok === true) {
    return Array.isArray(response.params) && response.params.every(isProfileParam)
  }
  return (
    response.ok === false &&
    (response.reason === 'not-pipeline-page' || response.reason === 'unavailable')
  )
}

function infoStatus(text: string): StatusState {
  return { tone: 'info', text }
}

function errorStatus(text: string): StatusState {
  return { tone: 'error', text }
}

let hydratePromise: Promise<void> | null = null

export const usePopupStore = create<PopupStore>((set, get) => {
  const commit = (shape: StorageShape, extra?: Partial<PopupStore>) => {
    set({ ...shape, ...extra })
    writeStorage(shape)
  }

  const shapeOf = (state: Pick<PopupStore, 'profiles' | 'currentProfileId'>): StorageShape => ({
    profiles: state.profiles,
    currentProfileId: state.currentProfileId,
  })

  const flushBulk = (): boolean => {
    const { view, bulkDraft, profiles, currentProfileId } = get()
    if (view !== 'bulk') {
      return true
    }
    const parsed = parseQuery(bulkDraft)
    if (!parsed.ok) {
      set({ status: errorStatus(STATUS.bulkError) })
      return false
    }
    const nextProfiles = mapCurrent(profiles, currentProfileId, (profile) => ({
      ...profile,
      params: parsed.params,
    }))
    commit(
      { profiles: nextProfiles, currentProfileId },
      { status: null },
    )
    return true
  }

  return {
    hydrated: false,
    profiles: [],
    currentProfileId: '',
    view: 'list',
    bulkDraft: '',
    status: null,
    busy: 'idle',

    hydrate: async () => {
      if (get().hydrated) {
        return
      }
      if (hydratePromise) {
        await hydratePromise
        return
      }

      hydratePromise = (async () => {
        if (!canUseStorage()) {
          const seeded = createDefaultStorage()
          set({
            ...seeded,
            hydrated: true,
            view: 'list',
            bulkDraft: '',
            status: null,
            busy: 'idle',
          })
          return
        }

        const raw = (await chrome.storage.local.get([
          'profiles',
          'currentProfileId',
        ])) as Record<string, unknown>
        const normalized = normalizeStorage(raw)
        const hadProfiles = Array.isArray(raw.profiles) && raw.profiles.length > 0
        if (!hadProfiles) {
          await chrome.storage.local.set(normalized)
        } else if (raw.currentProfileId !== normalized.currentProfileId) {
          writeStorage(normalized)
        }

        set({
          ...normalized,
          hydrated: true,
          view: 'list',
          bulkDraft: '',
          status: null,
          busy: 'idle',
        })
      })()

      try {
        await hydratePromise
      } finally {
        hydratePromise = null
      }
    },

    selectProfile: (id) => {
      const { profiles, currentProfileId, view } = get()
      if (id === currentProfileId) {
        return
      }
      const next = findProfile(profiles, id)
      if (!next) {
        return
      }
      commit(
        { profiles, currentProfileId: id },
        {
          bulkDraft: view === 'bulk' ? serializeParams(next.params) : get().bulkDraft,
          status: null,
        },
      )
    },

    addProfile: () => {
      const { profiles, view } = get()
      const profile = createEmptyProfile(nextProfileName(profiles))
      commit(
        {
          profiles: [...profiles, profile],
          currentProfileId: profile.id,
        },
        {
          bulkDraft: view === 'bulk' ? '' : get().bulkDraft,
          status: null,
        },
      )
    },

    renameProfile: (name) => {
      const trimmed = name.trim()
      if (!trimmed) {
        return false
      }
      const { profiles, currentProfileId } = get()
      const nextProfiles = mapCurrent(profiles, currentProfileId, (profile) => ({
        ...profile,
        name: trimmed,
      }))
      commit(shapeOf({ profiles: nextProfiles, currentProfileId }))
      return true
    },

    deleteCurrentProfile: () => {
      const { profiles, currentProfileId, view } = get()
      if (profiles.length <= 1) {
        return false
      }
      const index = profiles.findIndex((profile) => profile.id === currentProfileId)
      if (index < 0) {
        return false
      }
      const neighbor = profiles[index - 1] ?? profiles[index + 1]
      if (!neighbor) {
        return false
      }
      const nextProfiles = profiles.filter((profile) => profile.id !== currentProfileId)
      commit(
        { profiles: nextProfiles, currentProfileId: neighbor.id },
        {
          bulkDraft: view === 'bulk' ? serializeParams(neighbor.params) : get().bulkDraft,
          status: null,
        },
      )
      return true
    },

    addParam: () => {
      const { profiles, currentProfileId } = get()
      const nextProfiles = mapCurrent(profiles, currentProfileId, (profile) => ({
        ...profile,
        params: [
          ...profile.params,
          {
            id: createId(),
            type: 'variable',
            name: '',
            value: '',
          },
        ],
      }))
      commit(shapeOf({ profiles: nextProfiles, currentProfileId }))
    },

    updateParam: (paramId, patch) => {
      const { profiles, currentProfileId } = get()
      const current = findProfile(profiles, currentProfileId)
      if (!current) {
        return
      }

      if (patch.type === 'branch' && hasBranch(current.params, paramId)) {
        set({ status: errorStatus(STATUS.secondBranch) })
        return
      }

      const nextProfiles = mapCurrent(profiles, currentProfileId, (profile) => ({
        ...profile,
        params: profile.params.map((param) => {
          if (param.id !== paramId) {
            return param
          }
          const nextType = patch.type ?? param.type
          const nextName = nextType === 'branch' ? 'ref' : (patch.name ?? param.name)
          return {
            ...param,
            type: nextType,
            name: nextName,
            value: patch.value ?? param.value,
          }
        }),
      }))
      commit(shapeOf({ profiles: nextProfiles, currentProfileId }), { status: null })
    },

    removeParam: (paramId) => {
      const { profiles, currentProfileId } = get()
      const nextProfiles = mapCurrent(profiles, currentProfileId, (profile) => ({
        ...profile,
        params: profile.params.filter((param) => param.id !== paramId),
      }))
      commit(shapeOf({ profiles: nextProfiles, currentProfileId }))
    },

    setView: (view) => {
      const state = get()
      if (view === state.view) {
        return
      }
      if (view === 'bulk') {
        const current = findProfile(state.profiles, state.currentProfileId)
        set({
          view: 'bulk',
          bulkDraft: serializeParams(current?.params ?? []),
          status: null,
        })
        return
      }
      const parsed = parseQuery(state.bulkDraft)
      if (!parsed.ok) {
        set({ status: errorStatus(STATUS.bulkError) })
        return
      }
      const nextProfiles = mapCurrent(state.profiles, state.currentProfileId, (profile) => ({
        ...profile,
        params: parsed.params,
      }))
      commit(
        { profiles: nextProfiles, currentProfileId: state.currentProfileId },
        { view: 'list', status: null },
      )
    },

    setBulkDraft: (text) => {
      const { profiles, currentProfileId } = get()
      const parsed = parseQuery(text)
      if (!parsed.ok) {
        set({
          bulkDraft: text,
          status: errorStatus(STATUS.bulkError),
        })
        return
      }
      const nextProfiles = mapCurrent(profiles, currentProfileId, (profile) => ({
        ...profile,
        params: parsed.params,
      }))
      commit(
        { profiles: nextProfiles, currentProfileId },
        { bulkDraft: text, status: null },
      )
    },

    applyToTab: async () => {
      if (get().busy !== 'idle') {
        return
      }
      if (!flushBulk()) {
        return
      }
      set({ busy: 'applying' })
      try {
        if (!canUseTabs()) {
          set({ status: errorStatus(STATUS.applyNoRepo) })
          return
        }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id || !tab.url) {
          set({ status: errorStatus(STATUS.applyNoRepo) })
          return
        }
        const current = findProfile(get().profiles, get().currentProfileId)
        const nextUrl = buildApplyUrl(tab.url, current?.params ?? [])
        if (!nextUrl) {
          set({ status: errorStatus(STATUS.applyNoRepo) })
          return
        }
        if (tab.url === nextUrl) {
          await chrome.tabs.reload(tab.id)
        } else {
          await chrome.tabs.update(tab.id, { url: nextUrl })
        }
        set({ status: infoStatus(STATUS.applyOk) })
      } catch {
        set({ status: errorStatus(STATUS.applyNoRepo) })
      } finally {
        set({ busy: 'idle' })
      }
    },

    readFromPage: async () => {
      if (get().busy !== 'idle') {
        return
      }
      set({ busy: 'reading' })
      try {
        if (!canUseTabs()) {
          set({ status: errorStatus(STATUS.readNoScript) })
          return
        }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) {
          set({ status: errorStatus(STATUS.readNoScript) })
          return
        }
        const request: ReadFromPageRequest = { type: MSG_READ_FROM_PAGE }
        const raw: unknown = await chrome.tabs.sendMessage(tab.id, request)
        if (!isReadResponse(raw)) {
          set({ status: errorStatus(STATUS.readNoScript) })
          return
        }
        if (!raw.ok) {
          set({
            status: errorStatus(
              raw.reason === 'not-pipeline-page' ? STATUS.readWrongPage : STATUS.readNoScript,
            ),
          })
          return
        }

        const { profiles, currentProfileId, view } = get()
        const nextProfiles = mapCurrent(profiles, currentProfileId, (profile) => ({
          ...profile,
          params: raw.params,
        }))
        commit(
          { profiles: nextProfiles, currentProfileId },
          {
            bulkDraft: view === 'bulk' ? serializeParams(raw.params) : get().bulkDraft,
            status: infoStatus(STATUS.readOk),
          },
        )
      } catch {
        set({ status: errorStatus(STATUS.readNoScript) })
      } finally {
        set({ busy: 'idle' })
      }
    },
  }
})

export function selectCurrentProfile(state: PopupStore): Profile | undefined {
  return findProfile(state.profiles, state.currentProfileId)
}
