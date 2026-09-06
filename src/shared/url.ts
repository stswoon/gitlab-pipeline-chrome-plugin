import { serializeParams } from './query'
import type { ProfileParam } from './types'

const SERVICE_SEGMENTS = new Set(['explore', 'dashboard', 'users', 'admin', '-'])

function asUrl(url: string | URL): URL | null {
  if (url instanceof URL) {
    return url
  }
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function isNamedBracketKey(key: string, prefix: string): boolean {
  if (!key.startsWith(prefix) || !key.endsWith(']')) {
    return false
  }
  return key.slice(prefix.length, -1).trim() !== ''
}

export function isGitlabHost(hostname: string): boolean {
  return hostname.toLowerCase().includes('gitlab')
}

export function isNewPipelinePath(pathname: string): boolean {
  return pathname.includes('/-/pipelines/new')
}

export function hasSignificantQuery(search: string): boolean {
  const raw = search.startsWith('?') ? search.slice(1) : search
  if (!raw.trim()) {
    return false
  }

  const params = new URLSearchParams(raw)
  for (const key of params.keys()) {
    if (key === 'ref') {
      return true
    }
    if (isNamedBracketKey(key, 'var[') || isNamedBracketKey(key, 'input[')) {
      return true
    }
  }
  return false
}

export function shouldActivateFill(url: string | URL): boolean {
  const parsed = asUrl(url)
  if (!parsed) {
    return false
  }
  return (
    isGitlabHost(parsed.hostname) &&
    isNewPipelinePath(parsed.pathname) &&
    hasSignificantQuery(parsed.search)
  )
}

export function resolveRepoBase(url: string | URL): string | null {
  const parsed = asUrl(url)
  if (!parsed) {
    return null
  }

  const markerIndex = parsed.pathname.indexOf('/-/')
  if (markerIndex !== -1) {
    const repoPath = parsed.pathname.slice(0, markerIndex).replace(/\/+$/, '')
    if (!repoPath) {
      return null
    }
    return `${parsed.origin}${repoPath}`
  }

  if (!isGitlabHost(parsed.hostname)) {
    return null
  }

  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length < 2) {
    return null
  }

  const first = segments[0]
  if (!first || SERVICE_SEGMENTS.has(first.toLowerCase())) {
    return null
  }

  return `${parsed.origin}/${segments.join('/')}`
}

export function buildApplyUrl(tabUrl: string, params: ProfileParam[]): string | null {
  const base = resolveRepoBase(tabUrl)
  if (!base) {
    return null
  }
  return `${base}/-/pipelines/new?${serializeParams(params)}`
}
