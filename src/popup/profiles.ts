import type {Profile, ProfileStorage} from '../shared/types';

function nextDefaultName(profiles: ReadonlyArray<Pick<Profile, 'name'>>): string {
  const names = new Set(profiles.map((profile) => profile.name));
  let n = 1;
  while (names.has(`Profile ${n}`)) {
    n += 1;
  }
  return `Profile ${n}`;
}

export function normalizeStorage(raw: unknown): { value: ProfileStorage; didRepair: boolean } {
    if (!raw) {
        const newProfile = createProfile([]);
        return {
            value: {profiles: [newProfile], selectedProfileId: newProfile.id},
            didRepair: true
        };
    } else {
        return {value: raw as ProfileStorage, didRepair: false};
    }
}

export function createProfile(profiles: Profile[]): Profile {
    return {id: crypto.randomUUID(), name: nextDefaultName(profiles), params: [], bulkText: ''};
}

export function deleteProfile(profiles: Profile[], selectedProfileId: string | null, deleteId: string): ProfileStorage {
  const index = profiles.findIndex((profile) => profile.id === deleteId);
  if (index === -1) {
    return { profiles, selectedProfileId };
  }
  const next = profiles.filter((profile) => profile.id !== deleteId);
  if (next.length === 0) {
    const newProfile = createProfile([]);
    return { profiles: [newProfile], selectedProfileId: newProfile.id };
  }
  if (selectedProfileId !== deleteId && next.some((profile) => profile.id === selectedProfileId)) {
    return { profiles: next, selectedProfileId };
  }
  const selected = next[index] ?? next[next.length - 1] ?? null;
  return { profiles: next, selectedProfileId: selected?.id ?? null };
}

