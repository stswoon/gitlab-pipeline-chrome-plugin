import {Param} from "./types";

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
