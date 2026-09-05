import {normalizeStorage} from './profiles';
import {ProfileStorage} from "../shared/types";

export async function saveStorage(data: ProfileStorage): Promise<void> {
    await chrome.storage.local.set({profileStorage: data});
}

export async function loadStorage(): Promise<ProfileStorage> {
    let raw = await chrome.storage.local.get(['profileStorage']);
    raw = (raw as any).profileStorage;
    const {value, didRepair} = normalizeStorage(raw);
    if (didRepair) {
        await saveStorage(value);
    }
    return value;
}
