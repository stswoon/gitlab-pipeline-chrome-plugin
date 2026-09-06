export const PIPELINE_ROOT_SELECTOR = '#js-new-pipeline'
export const INPUT_ROW_SELECTOR = '[data-testid="input-row"]'
export const LOADING_TIMEOUT_MS = 10_000
export const BRANCH_TIMEOUT_MS = 15_000
export const SETTLE_QUIET_MS = 250
export const SETTLE_MAX_MS = 2_000

const BRANCH_SELECTORS = [
  '[data-testid="pipeline-form-ref-selector"]',
  '[data-testid="ref-selector"]',
  '[data-testid="pipeline-form-ref"]',
  '.ref-selector',
]

const LOADING_SELECTORS = [
  '[data-testid="inputs-table-skeleton"]',
  '[data-testid="pipeline-inputs-skeleton"]',
  '.gl-skeleton-loader',
  '[class*="skeleton-loader"]',
  '[data-testid="loading-icon"]',
  '.gl-spinner',
  '.gl-loading-icon',
]

const LISTBOX_TOGGLE_SELECTORS = [
  '[data-testid="base-dropdown-toggle"]',
  'button[aria-haspopup="listbox"]',
  'button[aria-haspopup="true"]',
  '.gl-new-dropdown-toggle',
]

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export async function waitFor<T>(
  probe: () => T | null | undefined | false,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T | null> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (signal?.aborted) {
      return null
    }
    const value = probe()
    if (value) {
      return value
    }
    await sleep(100)
  }
  return probe() || null
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
}

export function pipelineRoot(): Element {
  return document.querySelector(PIPELINE_ROOT_SELECTOR) ?? document.body
}

export function findBranchControl(): Element | null {
  const root = pipelineRoot()
  for (const selector of BRANCH_SELECTORS) {
    const match = root.querySelector(selector)
    if (match) {
      return match
    }
  }

  const hiddenRef = root.querySelector('input[name="ref"]')
  if (hiddenRef) {
    return hiddenRef.closest('[data-testid], .ref-selector, .gl-form-group') ?? hiddenRef
  }

  return null
}

export function readBranchDisplay(): string {
  const control = findBranchControl()
  if (control) {
    const toggle = findListboxToggle(control) ?? control
    const text = normalizeText(toggle.textContent ?? '')
    if (text && !isPlaceholderRef(text)) {
      return text.replace(/^refs\/(heads|tags)\//, '')
    }
  }

  const hidden = pipelineRoot().querySelector<HTMLInputElement>('input[name="ref"]')
  if (hidden?.value.trim()) {
    return hidden.value.trim().replace(/^refs\/(heads|tags)\//, '')
  }
  return ''
}

function isPlaceholderRef(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('no ref') || lower.includes('search refs')
}

export function isInputsLoading(root: Element = pipelineRoot()): boolean {
  return LOADING_SELECTORS.some((selector) => root.querySelector(selector))
}

export function findInputsSection(): Element | null {
  const root = pipelineRoot()
  const anchor = root.querySelector(
    [
      INPUT_ROW_SELECTOR,
      '[data-testid="empty-selection-state"]',
      '[data-testid="no-inputs-empty-state"]',
      '[data-testid="input-description-cell"]',
    ].join(', '),
  )
  if (!anchor) {
    return null
  }
  return (
    anchor.closest('.crud, [class*="crud"], .gl-card, section, [data-testid="crud-component"]') ??
    anchor.closest(PIPELINE_ROOT_SELECTOR) ??
    anchor
  )
}

export function findInputRows(): HTMLElement[] {
  const byTestId = [...pipelineRoot().querySelectorAll<HTMLElement>(INPUT_ROW_SELECTOR)]
  if (byTestId.length) {
    return byTestId
  }

  const description = pipelineRoot().querySelector('[data-testid="input-description-cell"]')
  const table = description?.closest('table')
  if (!table) {
    return []
  }
  return [...table.querySelectorAll<HTMLElement>('tbody tr')]
}

export function hasEmptyInputsSection(): boolean {
  const root = pipelineRoot()
  if (root.querySelector('[data-testid="no-inputs-empty-state"], [data-testid="empty-selection-state"]')) {
    return true
  }
  return findInputRows().length === 0
}

export function normalizeName(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\s*\*\s*$/g, '').trim()
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function getInputRowName(row: Element): string {
  const named = row.querySelector('[data-testid="input-name"]')
  if (named) {
    return normalizeName(named.textContent ?? '')
  }
  const firstCell = row.querySelector('th, td, [role="cell"]')
  if (firstCell) {
    const clone = firstCell.cloneNode(true)
    if (clone instanceof Element) {
      clone.querySelectorAll('[data-testid="required-asterisk"]').forEach((node) => node.remove())
      return normalizeName(clone.textContent ?? '')
    }
  }
  return ''
}

export function getValueCell(row: Element): Element | null {
  const cells = [...row.querySelectorAll('td, [role="cell"]')]
  if (cells.length) {
    return cells[cells.length - 1] ?? null
  }
  return row
}

export function findListboxToggle(scope: Element): HTMLElement | null {
  if (scope.matches(LISTBOX_TOGGLE_SELECTORS.join(', ')) && scope instanceof HTMLElement) {
    return scope
  }
  for (const selector of LISTBOX_TOGGLE_SELECTORS) {
    const match = scope.querySelector<HTMLElement>(selector)
    if (match) {
      return match
    }
  }
  return null
}

export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  if (descriptor?.set) {
    descriptor.set.call(el, value)
  } else {
    el.value = value
  }
  el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

export function fieldControl(
  root: Element,
  testids: string[],
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  for (const testid of testids) {
    const host = root.querySelector(`[data-testid="${testid}"]`)
    if (!host) {
      continue
    }
    if (
      host instanceof HTMLInputElement ||
      host instanceof HTMLTextAreaElement ||
      host instanceof HTMLSelectElement
    ) {
      return host
    }
    const inner = host.querySelector('input, textarea, select')
    if (
      inner instanceof HTMLInputElement ||
      inner instanceof HTMLTextAreaElement ||
      inner instanceof HTMLSelectElement
    ) {
      return inner
    }
  }
  return null
}

export function controlValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null): string {
  if (!el) {
    return ''
  }
  return el.value.trim()
}

export async function stabilizeDom(root: Element, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(quietTimer)
      window.clearTimeout(maxTimer)
      observer.disconnect()
      resolve()
    }

    let quietTimer = window.setTimeout(finish, SETTLE_QUIET_MS)
    const maxTimer = window.setTimeout(finish, SETTLE_MAX_MS)
    const observer = new MutationObserver(() => {
      if (signal?.aborted) {
        finish()
        return
      }
      window.clearTimeout(quietTimer)
      quietTimer = window.setTimeout(finish, SETTLE_QUIET_MS)
    })
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    signal?.addEventListener('abort', finish, { once: true })
  })
}

export function findSelectInputsToggle(): HTMLElement | null {
  const section = findInputsSection()
  if (!section) {
    return null
  }

  const header =
    section.querySelector('.crud-header, [class*="crud-header"], .gl-card-header, header') ?? section
  const toggles = [...header.querySelectorAll<HTMLElement>(LISTBOX_TOGGLE_SELECTORS.join(', '))]
  return toggles[0] ?? findListboxToggle(header)
}

function isVisible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0
}

export function findListboxOption(value: string, scope: ParentNode = document): HTMLElement | null {
  const escaped = CSS.escape(value)
  const candidates = [
    ...scope.querySelectorAll<HTMLElement>(`[data-testid="listbox-item-${escaped}"]`),
    ...scope.querySelectorAll<HTMLElement>('[role="option"], [data-testid^="listbox-item-"]'),
  ]

  for (const option of candidates) {
    if (!isVisible(option)) {
      continue
    }
    const testid = option.getAttribute('data-testid') ?? ''
    const dataValue = option.getAttribute('data-value') ?? option.getAttribute('data-option-value') ?? ''
    const label = normalizeText(option.textContent ?? '')
    const testidValue = testid.startsWith('listbox-item-') ? testid.slice('listbox-item-'.length) : ''
    if (dataValue === value || testidValue === value || label === value) {
      return option
    }
  }
  return null
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
