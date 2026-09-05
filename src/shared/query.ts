export type Param = { key: string; value: string };

export type Profile = {
  id: string;
  name: string;
  params: Param[];
  bulkText?: string;
};

export type StorageShape = {
  profiles: Profile[];
  selectedProfileId: string | null;
};

export function parseQuery(input: string): Param[] {
  let source = input.trim();
  if (source.startsWith('?')) {
    source = source.slice(1);
  }
  if (source === '') {
    return [];
  }

  const seenIndex = new Map<string, number>();
  const params: Param[] = [];
  for (const [key, value] of new URLSearchParams(source)) {
    const existing = seenIndex.get(key);
    if (existing === undefined) {
      seenIndex.set(key, params.length);
      params.push({ key, value });
    } else {
      params[existing] = { key, value };
    }
  }
  return params;
}

export function serializeParams(params: Param[]): string {
  const search = new URLSearchParams();
  for (const { key, value } of params) {
    if (key.trim() === '') {
      continue;
    }
    search.append(key, value);
  }
  const encoded = search.toString();
  return encoded === '' ? '' : `?${encoded}`;
}

export function splitListValues(raw: string): string[] {
  return raw
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token !== '');
}

export function projectBaseFromHref(tabHref: string): string | null {
  let href = tabHref;
  const hashAt = href.indexOf('#');
  if (hashAt !== -1) {
    href = href.slice(0, hashAt);
  }
  const queryAt = href.indexOf('?');
  if (queryAt !== -1) {
    href = href.slice(0, queryAt);
  }
  const markerAt = href.indexOf('/-/');
  if (markerAt === -1) {
    return null;
  }
  return href.slice(0, markerAt);
}

export function buildPipelineNewUrl(tabHref: string, params: Param[]): string | null {
  const base = projectBaseFromHref(tabHref);
  if (base === null) {
    return null;
  }
  return `${base}/-/pipelines/new${serializeParams(params)}`;
}

export function displayBulkText(profile: Profile): string {
  return profile.bulkText !== undefined ? profile.bulkText : serializeParams(profile.params);
}

export function applyBulkInput(
  profile: Profile,
  raw: string,
): { profile: Profile; bulkValid: boolean } {
  if (!isValidBulkText(raw)) {
    return { profile: { ...profile, bulkText: raw }, bulkValid: false };
  }
  return {
    profile: { ...profile, bulkText: raw, params: parseQuery(raw) },
    bulkValid: true,
  };
}

export function isValidBulkText(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '?') {
    return true;
  }
  if (trimmed.includes('#')) {
    return false;
  }
  if (/[ \t\n\r]/.test(trimmed)) {
    return false;
  }
  const body = trimmed.startsWith('?') ? trimmed.slice(1) : trimmed;
  for (const segment of body.split('&')) {
    if (segment === '') {
      continue;
    }
    if (segment.startsWith('=')) {
      return false;
    }
  }
  return true;
}
