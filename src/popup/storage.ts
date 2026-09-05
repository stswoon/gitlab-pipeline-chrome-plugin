import { normalizeStorage } from '../shared/profiles';
import type { StorageShape } from '../shared/query';

export async function saveStorage(data: StorageShape): Promise<void> {
  await chrome.storage.local.set({
    profiles: data.profiles,
    selectedProfileId: data.selectedProfileId,
  });
}

export async function loadStorage(): Promise<StorageShape> {
  const raw = await chrome.storage.local.get(['profiles', 'selectedProfileId']);
  const { value, didRepair } = normalizeStorage(raw);
  if (didRepair || raw.profiles === undefined) {
    await saveStorage(value);
  }
  return value;
}
