import type { ProfileParam } from '@/shared/types'
import {
  controlValue,
  fieldControl,
  findInputRows,
  findListboxToggle,
  getInputRowName,
  getValueCell,
  normalizeText,
  pipelineRoot,
  readBranchDisplay,
} from './dom'

function createParam(type: ProfileParam['type'], name: string, value: string): ProfileParam {
  return {
    id: crypto.randomUUID(),
    type,
    name,
    value,
  }
}

function scrapeBranch(): ProfileParam | null {
  const fromUi = readBranchDisplay()
  if (fromUi) {
    return createParam('branch', 'ref', fromUi)
  }

  const fromUrl = new URLSearchParams(location.search).get('ref')?.trim()
  if (fromUrl) {
    return createParam('branch', 'ref', fromUrl.replace(/^refs\/(heads|tags)\//, ''))
  }
  return null
}

function isFileVariable(row: Element): boolean {
  if (row.querySelector('input[type="file"]')) {
    return true
  }

  const typeControl = row.querySelector('[data-testid="pipeline-form-ci-variable-type"]')
  if (!typeControl) {
    return false
  }

  const bits = [
    typeControl.getAttribute('data-selected-value'),
    typeControl.getAttribute('data-value'),
    typeControl.textContent,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (bits.includes('env_var') || bits.includes('variable')) {
    return false
  }
  return /\bfile\b/.test(bits)
}

function scrapeVariables(): ProfileParam[] {
  const root = pipelineRoot()
  const containers = root.querySelectorAll('[data-testid="ci-variable-row-container"]')
  const rows = containers.length ? containers : root.querySelectorAll('[data-testid="ci-variable-row"]')
  const params: ProfileParam[] = []

  for (const row of rows) {
    if (isFileVariable(row)) {
      continue
    }

    const key = controlValue(
      fieldControl(row, ['pipeline-form-ci-variable-key-field', 'pipeline-form-ci-variable-key']),
    )
    if (!key) {
      continue
    }

    const valueEl = fieldControl(row, [
      'pipeline-form-ci-variable-value-field',
      'pipeline-form-ci-variable-value',
      'pipeline-form-ci-variable-value-dropdown',
    ])
    let value = controlValue(valueEl)
    if (!value) {
      const toggle = findListboxToggle(
        row.querySelector('[data-testid="pipeline-form-ci-variable-value-dropdown"]') ?? row,
      )
      const toggleText = normalizeText(toggle?.textContent ?? '')
      if (toggleText && !toggleText.toLowerCase().includes('select')) {
        value = toggleText
      }
    }

    params.push(createParam('variable', key, value))
  }

  return params
}

function scrapeInputValue(row: Element): string {
  const valueCell = getValueCell(row)
  if (!valueCell) {
    return ''
  }

  const nativeSelect = valueCell.querySelector('select')
  if (nativeSelect) {
    return nativeSelect.value.trim()
  }

  const textControl = valueCell.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea',
  )
  if (textControl) {
    return textControl.value.trim()
  }

  const checkbox = valueCell.querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (checkbox) {
    return checkbox.checked ? 'true' : ''
  }

  const toggle = findListboxToggle(valueCell)
  const text = normalizeText(toggle?.textContent ?? '')
  if (!text || text.toLowerCase().includes('select option')) {
    return ''
  }
  return text
}

function scrapeInputs(): ProfileParam[] {
  const params: ProfileParam[] = []
  for (const row of findInputRows()) {
    const name = getInputRowName(row)
    const value = scrapeInputValue(row)
    if (!name || !value) {
      continue
    }
    params.push(createParam('input', name, value))
  }
  return params
}

export function scrapePipelinePage(): ProfileParam[] {
  const params: ProfileParam[] = []
  const branch = scrapeBranch()
  if (branch) {
    params.push(branch)
  }
  params.push(...scrapeVariables())
  params.push(...scrapeInputs())
  return params
}
