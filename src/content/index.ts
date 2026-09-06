import { MSG_READ_FROM_PAGE } from '@/shared/messages'
import type { ReadFromPageRequest, ReadFromPageResponse } from '@/shared/messages'
import { isGitlabHost, isNewPipelinePath } from '@/shared/url'
import { isAbortError, isInputsLoading, pipelineRoot, readBranchDisplay } from './dom'
import { fillInputsFromUrl } from './fill'
import { subscribeLocationChange } from './location'
import { logError } from './log'
import { shouldFillInputs } from './params'
import { scrapePipelinePage } from './scrape'

type FillState = 'idle' | 'waitingInputs' | 'filling' | 'done' | 'skippedInputs'

let state: FillState = 'idle'
let runToken = 0
let abort: AbortController | null = null
let lastSignature = ''

function fillSignature(): string {
  return `${location.pathname}${location.search}|${readBranchDisplay()}`
}

function isReadRequest(message: unknown): message is ReadFromPageRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as ReadFromPageRequest).type === MSG_READ_FROM_PAGE
  )
}

function handleReadFromPage(): ReadFromPageResponse {
  if (!isGitlabHost(location.hostname) || !isNewPipelinePath(location.pathname)) {
    return { ok: false, reason: 'not-pipeline-page' }
  }
  try {
    return { ok: true, params: scrapePipelinePage() }
  } catch (error) {
    logError('Read from page failed', error)
    return { ok: false, reason: 'unavailable' }
  }
}

async function runFill(signal: AbortSignal): Promise<void> {
  state = 'waitingInputs'
  const result = await fillInputsFromUrl(signal, () => {
    if (!signal.aborted) {
      state = 'filling'
    }
  })
  if (signal.aborted) {
    return
  }
  state = result
}

function evaluate(): void {
  if (!shouldFillInputs()) {
    abort?.abort()
    abort = null
    state = 'idle'
    lastSignature = fillSignature()
    return
  }

  const signature = fillSignature()
  const same = signature === lastSignature
  if (same && (state === 'waitingInputs' || state === 'filling')) {
    return
  }
  if (same && (state === 'done' || state === 'skippedInputs') && !isInputsLoading()) {
    return
  }

  lastSignature = signature
  abort?.abort()
  abort = new AbortController()
  const token = ++runToken
  const signal = abort.signal

  void runFill(signal).catch((error: unknown) => {
    if (token !== runToken || isAbortError(error)) {
      return
    }
    logError('Inputs fill failed', error)
    state = 'idle'
  })
}

function watchFormChanges(onChange: () => void): void {
  let lastBranch = readBranchDisplay()
  let lastLoading = isInputsLoading()

  const check = () => {
    const branch = readBranchDisplay()
    const loading = isInputsLoading()
    const branchChanged = branch !== lastBranch
    const loadingStarted = loading && !lastLoading
    lastBranch = branch
    lastLoading = loading
    if (branchChanged || loadingStarted) {
      onChange()
    }
  }

  const observer = new MutationObserver(check)
  const observe = (root: Element) => {
    observer.disconnect()
    observer.observe(root, { childList: true, subtree: true, characterData: true })
  }

  observe(pipelineRoot())
  const boot = new MutationObserver(() => {
    const mounted = document.querySelector('#js-new-pipeline')
    if (mounted) {
      observe(mounted)
    }
  })
  boot.observe(document.documentElement, { childList: true, subtree: true })
}

function boot(): void {
  subscribeLocationChange(evaluate)
  watchFormChanges(evaluate)
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isReadRequest(message)) {
      return
    }
    sendResponse(handleReadFromPage())
  })
  evaluate()
}

boot()
