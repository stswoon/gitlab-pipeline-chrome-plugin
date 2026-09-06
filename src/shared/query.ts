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

function upsertByName(
  map: Map<string, ProfileParam>,
  type: 'variable' | 'input',
  name: string,
  value: string,
) {
  const existing = map.get(name)
  if (existing) {
    existing.value = value
    return
  }
  map.set(name, {
    id: createParamId(),
    type,
    name,
    value,
  })
}

export function serializeParams(params: ProfileParam[]): string {
  let refValue: string | undefined
  const variables = new Map<string, string>()
  const inputs = new Map<string, string>()

  for (const param of params) {
    const name = param.name.trim()
    const value = param.value.trim()
    if (!name) {
      continue
    }

    if (param.type === 'branch') {
      refValue = value
      continue
    }

    if (param.type === 'variable') {
      variables.set(name, value)
      continue
    }

    if (param.type === 'input') {
      inputs.set(name, value)
    }
  }

  const parts: string[] = []
  if (refValue !== undefined) {
    parts.push(`ref=${encodeComponent(refValue)}`)
  }
  for (const [name, value] of variables) {
    parts.push(`var[${encodeComponent(name)}]=${encodeComponent(value)}`)
  }
  for (const [name, value] of inputs) {
    parts.push(`input[${encodeComponent(name)}]=${encodeComponent(value)}`)
  }
  return parts.join('&')
}

export function parseQuery(text: string): ParseQueryResult {
  const tokens = splitTokens(text)
  let branch: ProfileParam | undefined
  const variables = new Map<string, ProfileParam>()
  const inputs = new Map<string, ProfileParam>()

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
      branch = {
        id: createParamId(),
        type: 'branch',
        name: 'ref',
        value: decodedValue,
      }
      continue
    }

    if (isClosedBracketKey(decodedKey, VAR_PREFIX)) {
      const name = decodedKey.slice(VAR_PREFIX.length, -1).trim()
      if (!name) {
        continue
      }
      upsertByName(variables, 'variable', name, decodedValue)
      continue
    }

    if (isClosedBracketKey(decodedKey, INPUT_PREFIX)) {
      const name = decodedKey.slice(INPUT_PREFIX.length, -1).trim()
      if (!name) {
        continue
      }
      upsertByName(inputs, 'input', name, decodedValue)
    }
  }

  const params: ProfileParam[] = []
  if (branch) {
    params.push(branch)
  }
  params.push(...variables.values())
  params.push(...inputs.values())
  return { ok: true, params }
}
