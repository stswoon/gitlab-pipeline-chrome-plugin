export const LOG_PREFIX = '[gitlab-pipeline-helper]'

export function logWarn(...args: unknown[]): void {
  console.warn(LOG_PREFIX, ...args)
}

export function logError(...args: unknown[]): void {
  console.error(LOG_PREFIX, ...args)
}
