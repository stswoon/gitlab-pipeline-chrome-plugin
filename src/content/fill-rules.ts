export function isSkippedFillKey(key: string): boolean {
  return key === '' || key.startsWith('_');
}

export function parseBooleanQuery(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return null;
}

export function listSelection(raw: string, existingOptions: string[]): string[] {
  const tokens = splitListValues(raw);
  return existingOptions.filter((option) => tokens.includes(option));
}

function splitListValues(raw: string): string[] {
    return raw
        .split(',')
        .map((token) => token.trim())
        .filter((token) => token !== '');
}
