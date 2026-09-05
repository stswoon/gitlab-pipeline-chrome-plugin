import type { Param, Profile, StorageShape } from './query';

function isParam(value: unknown): value is Param {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as Param;
  return typeof row.key === 'string' && typeof row.value === 'string';
}

function isProfile(value: unknown): value is Profile {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const profile = value as Profile;
  return (
    typeof profile.id === 'string' &&
    typeof profile.name === 'string' &&
    Array.isArray(profile.params) &&
    profile.params.every(isParam)
  );
}

export function nextDefaultName(profiles: ReadonlyArray<Pick<Profile, 'name'>>): string {
  const names = new Set(profiles.map((profile) => profile.name));
  let n = 1;
  while (names.has(`Profile ${n}`)) {
    n += 1;
  }
  return `Profile ${n}`;
}

export function normalizeStorage(raw: unknown): { value: StorageShape; didRepair: boolean } {
  const obj = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const incoming = Array.isArray(obj.profiles) ? obj.profiles : [];
  const profiles = incoming.filter(isProfile);
  let didRepair = !Array.isArray(obj.profiles) || profiles.length !== incoming.length;

  let selectedProfileId: string | null = null;
  if (obj.selectedProfileId === null || obj.selectedProfileId === undefined) {
    selectedProfileId = null;
  } else if (typeof obj.selectedProfileId === 'string') {
    selectedProfileId = obj.selectedProfileId;
  } else {
    selectedProfileId = null;
    didRepair = true;
  }

  if (selectedProfileId !== null && !profiles.some((profile) => profile.id === selectedProfileId)) {
    selectedProfileId = profiles[0]?.id ?? null;
    didRepair = true;
  }

  return { value: { profiles, selectedProfileId }, didRepair };
}

export function createProfile(profiles: Profile[]): { profiles: Profile[]; created: Profile } {
  const created: Profile = {
    id: crypto.randomUUID(),
    name: nextDefaultName(profiles),
    params: [],
  };
  return { profiles: [...profiles, created], created };
}

export function deleteProfile(
  profiles: Profile[],
  selectedProfileId: string | null,
  deleteId: string,
): { profiles: Profile[]; selectedProfileId: string | null } {
  const index = profiles.findIndex((profile) => profile.id === deleteId);
  if (index === -1) {
    return { profiles, selectedProfileId };
  }
  const next = profiles.filter((profile) => profile.id !== deleteId);
  if (selectedProfileId !== deleteId && next.some((profile) => profile.id === selectedProfileId)) {
    return { profiles: next, selectedProfileId };
  }
  const selected = next[index] ?? next[next.length - 1] ?? null;
  return { profiles: next, selectedProfileId: selected?.id ?? null };
}

export function tryUpdateRowKey(
  params: Param[],
  index: number,
  nextKey: string,
): { params: Param[]; error: string | null } {
  if (nextKey !== '' && params.some((param, i) => i !== index && param.key === nextKey)) {
    return { params, error: 'Keys must be unique.' };
  }
  return {
    params: params.map((param, i) => (i === index ? { ...param, key: nextKey } : param)),
    error: null,
  };
}

export function addEmptyRow(params: Param[]): Param[] {
  return [...params, { key: '', value: '' }];
}

export function removeRowAt(params: Param[], index: number): Param[] {
  return params.filter((_, i) => i !== index);
}

export function updateRowValue(params: Param[], index: number, value: string): Param[] {
  return params.map((param, i) => (i === index ? { ...param, value } : param));
}
