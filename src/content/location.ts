type LocationListener = () => void

function notifyIfChanged(lastHref: { value: string }, listener: LocationListener): void {
  if (location.href === lastHref.value) {
    return
  }
  lastHref.value = location.href
  listener()
}

export function subscribeLocationChange(listener: LocationListener): () => void {
  const lastHref = { value: location.href }
  const notify = () => notifyIfChanged(lastHref, listener)

  const originalPush = history.pushState
  const originalReplace = history.replaceState

  history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
    const result = originalPush.apply(this, args)
    notify()
    return result
  }
  history.replaceState = function (this: History, ...args: Parameters<History['replaceState']>) {
    const result = originalReplace.apply(this, args)
    notify()
    return result
  }

  window.addEventListener('popstate', notify)
  window.addEventListener('hashchange', notify)
  const pollId = window.setInterval(notify, 400)

  return () => {
    history.pushState = originalPush
    history.replaceState = originalReplace
    window.removeEventListener('popstate', notify)
    window.removeEventListener('hashchange', notify)
    window.clearInterval(pollId)
  }
}
