import type { ProfileParam } from '@/shared/types'
import {
  BRANCH_TIMEOUT_MS,
  LOADING_TIMEOUT_MS,
  findBranchControl,
  findInputRows,
  findListboxOption,
  findListboxToggle,
  findSelectInputsToggle,
  getInputRowName,
  getValueCell,
  hasEmptyInputsSection,
  isInputsLoading,
  pipelineRoot,
  setNativeValue,
  sleep,
  stabilizeDom,
  throwIfAborted,
  waitFor,
} from './dom'
import { logWarn } from './log'
import { readInputParams } from './params'

async function waitForBranch(signal: AbortSignal): Promise<boolean> {
  const found = await waitFor(() => findBranchControl(), BRANCH_TIMEOUT_MS, signal)
  return Boolean(found)
}

async function waitForLoadingToFinish(signal: AbortSignal): Promise<void> {
  await sleep(50)
  const started = Date.now()
  while (Date.now() - started < LOADING_TIMEOUT_MS) {
    throwIfAborted(signal)
    if (!isInputsLoading()) {
      return
    }
    await sleep(100)
  }
}

function findRowByName(name: string): HTMLElement | null {
  for (const row of findInputRows()) {
    if (getInputRowName(row) === name) {
      return row
    }
  }
  return null
}

function fillNativeSelect(select: HTMLSelectElement, value: string): boolean {
  const options = [...select.options]
  const match = options.find((option) => option.value === value) ?? options.find((option) => option.text.trim() === value)
  if (!match) {
    return false
  }
  select.value = match.value
  select.dispatchEvent(new Event('input', { bubbles: true }))
  select.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

async function fillListbox(scope: Element, value: string, signal: AbortSignal): Promise<boolean> {
  const toggle = findListboxToggle(scope)
  if (!toggle) {
    return false
  }

  const expanded = toggle.getAttribute('aria-expanded') === 'true'
  if (!expanded) {
    toggle.click()
    await sleep(80)
  }
  throwIfAborted(signal)

  const search = document.querySelector<HTMLInputElement>(
    '[data-testid="listbox-search-input"], .gl-listbox-search input, input[type="search"]',
  )
  if (search) {
    setNativeValue(search, value)
    await sleep(200)
  }

  const option = await waitFor(() => findListboxOption(value), 1500, signal)
  if (!option) {
    if (toggle.getAttribute('aria-expanded') === 'true') {
      toggle.click()
    }
    return false
  }
  option.click()
  await sleep(80)
  return true
}

async function fillWidget(row: Element, value: string, signal: AbortSignal): Promise<boolean> {
  const valueCell = getValueCell(row)
  if (!valueCell) {
    return false
  }

  const nativeSelect = valueCell.querySelector('select')
  if (nativeSelect) {
    return fillNativeSelect(nativeSelect, value)
  }

  const textControl = valueCell.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea',
  )
  if (textControl) {
    setNativeValue(textControl, value)
    return true
  }

  if (findListboxToggle(valueCell)) {
    return fillListbox(valueCell, value, signal)
  }

  const checkbox = valueCell.querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (checkbox) {
    const wanted = /^(true|1|yes)$/i.test(value)
    if (checkbox.checked !== wanted) {
      checkbox.click()
    }
    return true
  }

  return false
}

async function trySelectInput(name: string, signal: AbortSignal): Promise<HTMLElement | null> {
  const toggle = findSelectInputsToggle()
  if (!toggle) {
    return null
  }

  if (toggle.getAttribute('aria-expanded') !== 'true') {
    toggle.click()
    await sleep(80)
  }
  throwIfAborted(signal)

  const search = document.querySelector<HTMLInputElement>(
    '[data-testid="listbox-search-input"], .gl-listbox-search input, input[type="search"]',
  )
  if (search) {
    setNativeValue(search, name)
    await sleep(200)
  }

  const option = await waitFor(() => findListboxOption(name), 1500, signal)
  if (!option) {
    if (toggle.getAttribute('aria-expanded') === 'true') {
      toggle.click()
    }
    return null
  }

  option.click()
  await sleep(80)
  return waitFor(() => findRowByName(name), 2000, signal)
}

async function applyInputParam(param: ProfileParam, signal: AbortSignal): Promise<void> {
  const name = param.name.trim()
  if (!name) {
    return
  }

  let row = findRowByName(name)
  if (!row) {
    row = await trySelectInput(name, signal)
  }
  if (!row) {
    return
  }

  const ok = await fillWidget(row, param.value, signal)
  if (!ok) {
    logWarn(`Could not fill input "${name}"`)
  }
}

export async function fillInputsFromUrl(
  signal: AbortSignal,
  onFilling?: () => void,
): Promise<'done' | 'skippedInputs'> {
  throwIfAborted(signal)
  const ready = await waitForBranch(signal)
  if (!ready) {
    logWarn('Branch/tag control did not appear; skipping Inputs fill')
    return 'skippedInputs'
  }

  throwIfAborted(signal)
  await waitForLoadingToFinish(signal)
  throwIfAborted(signal)
  await stabilizeDom(pipelineRoot(), signal)
  throwIfAborted(signal)

  if (hasEmptyInputsSection()) {
    return 'skippedInputs'
  }

  onFilling?.()
  const inputs = readInputParams()
  for (const param of inputs) {
    throwIfAborted(signal)
    await applyInputParam(param, signal)
  }
  return 'done'
}
