import { parseQuery } from '@/shared/query'
import { shouldActivateFill } from '@/shared/url'
import type { ProfileParam } from '@/shared/types'

export function readInputParams(search = location.search): ProfileParam[] {
  const parsed = parseQuery(search)
  if (!parsed.ok) {
    return []
  }
  return parsed.params.filter((param) => param.type === 'input')
}

export function shouldFillInputs(url: string = location.href): boolean {
  if (!shouldActivateFill(url)) {
    return false
  }
  try {
    return readInputParams(new URL(url).search).length > 0
  } catch {
    return false
  }
}
