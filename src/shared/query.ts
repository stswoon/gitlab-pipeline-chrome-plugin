import type { ProfileParam } from './types'

export type ParseQueryResult =
  | { ok: true; params: ProfileParam[] }
  | { ok: false }

const VAR_PREFIX = 'var['
const INPUT_PREFIX = 'input['

function createParamId(): string {
  return crypto.randomUUID()
}

function encodeComponent(value: string): string {
  return encodeURIComponent(value)
}

function decodeComponent(raw: string): string | null {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '))
  } catch {
    return null
  }
}

function isClosedBracketKey(key: string, prefix: string): boolean {
  return key.startsWith(prefix) && key.endsWith(']') && !key.slice(prefix.length, -1).includes(']')
}

function isBrokenBracketKey(key: string): boolean {
  if (key.startsWith(VAR_PREFIX)) {
    return !isClosedBracketKey(key, VAR_PREFIX)
  }
  if (key.startsWith(INPUT_PREFIX)) {
    return !isClosedBracketKey(key, INPUT_PREFIX)
  }
  return false
}

function splitTokens(text: string): string[] {
  const normalized = text
    .replace(/^\?/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  const tokens: string[] = []
  for (const line of normalized.split('\n')) {
    for (const part of line.split('&')) {
      const token = part.trim()
      if (token) {
        tokens.push(token)
      }
    }
  }
  return tokens
}

type DraftParam = {
  type: ProfileParam['type']
  name: string
  value: string
}

function draftKey(draft: DraftParam): string {
  return draft.type === 'branch' ? 'branch' : `${draft.type}:${draft.name}`
}

function keepLastOccurrences(drafts: DraftParam[]): DraftParam[] {
  const seen = new Set<string>()
  const kept: DraftParam[] = []
  for (let i = drafts.length - 1; i >= 0; i -= 1) {
    const draft = drafts[i]
    if (!draft) {
      continue
    }
    const key = draftKey(draft)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    kept.unshift(draft)
  }
  return kept
}

export function serializeParams(params: ProfileParam[]): string {
  const parts: string[] = []

  for (const param of params) {
    const name = param.name.trim()
    const value = param.value.trim()
    if (!name) {
      continue
    }

    if (param.type === 'branch') {
      parts.push(`ref=${encodeComponent(value)}`)
      continue
    }

    if (param.type === 'variable') {
      parts.push(`var[${encodeComponent(name)}]=${encodeComponent(value)}`)
      continue
    }

    if (param.type === 'input') {
      parts.push(`input[${encodeComponent(name)}]=${encodeComponent(value)}`)
    }
  }

  return parts.join('&')
}

export function parseQuery(text: string): ParseQueryResult {
  const tokens = splitTokens(text)
  const drafts: DraftParam[] = []

  for (const token of tokens) {
    const eq = token.indexOf('=')
    if (eq <= 0) {
      return { ok: false }
    }

    const rawKey = token.slice(0, eq).trim()
    const rawValue = token.slice(eq + 1).trim()
    if (!rawKey) {
      return { ok: false }
    }

    const key = decodeComponent(rawKey)
    const value = decodeComponent(rawValue)
    if (key === null || value === null) {
      return { ok: false }
    }

    const decodedKey = key.trim()
    const decodedValue = value.trim()
    if (!decodedKey) {
      return { ok: false }
    }

    if (isBrokenBracketKey(decodedKey)) {
      return { ok: false }
    }

    if (decodedKey === 'ref') {
      drafts.push({
        type: 'branch',
        name: 'ref',
        value: decodedValue,
      })
      continue
    }

    if (isClosedBracketKey(decodedKey, VAR_PREFIX)) {
      const name = decodedKey.slice(VAR_PREFIX.length, -1).trim()
      if (!name) {
        continue
      }
      drafts.push({ type: 'variable', name, value: decodedValue })
      continue
    }

    if (isClosedBracketKey(decodedKey, INPUT_PREFIX)) {
      const name = decodedKey.slice(INPUT_PREFIX.length, -1).trim()
      if (!name) {
        continue
      }
      drafts.push({ type: 'input', name, value: decodedValue })
    }
  }

  return {
    ok: true,
    params: keepLastOccurrences(drafts).map((draft) => ({
      id: createParamId(),
      type: draft.type,
      name: draft.name,
      value: draft.value,
    })),
  }
}
