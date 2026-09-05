export type Param = { key: string; value: string };

export type Profile = {
  id: string;
  name: string;
  params: Param[];
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
