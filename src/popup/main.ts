import { createProfile, deleteProfile } from '../shared/profiles';
import {
  applyBulkInput,
  displayBulkText,
  isValidBulkText,
  type Profile,
  type StorageShape,
} from '../shared/query';
import { APPLY_NOT_PROJECT, decideApplyUrl } from './apply-url';
import { loadStorage, saveStorage } from './storage';
import { displayProfileName, isApplyDisabled, syncPopupShell } from './ui-state';

const INVALID_BULK = 'Invalid query string.';

let state: StorageShape = { profiles: [], selectedProfileId: null };
let bulkValid = true;
let errorText = '';

function selectedProfile(): Profile | null {
  return state.profiles.find((profile) => profile.id === state.selectedProfileId) ?? null;
}

function errorEl(): HTMLElement {
  return document.getElementById('error-line') as HTMLElement;
}

function setError(text: string): void {
  errorText = text;
  errorEl().textContent = text;
}

function clearApplyError(): void {
  if (errorText === APPLY_NOT_PROJECT) {
    setError('');
  }
}

async function persist(): Promise<void> {
  await saveStorage(state);
}

function syncBulkTextarea(): void {
  const textarea = document.getElementById('bulk-text') as HTMLTextAreaElement;
  if (document.activeElement === textarea) {
    return;
  }
  const profile = selectedProfile();
  textarea.value = profile ? displayBulkText(profile) : '';
}

function render(): void {
  const app = document.getElementById('app') as HTMLElement;
  const apply = document.getElementById('btn-apply') as HTMLButtonElement;
  const del = document.getElementById('btn-delete') as HTMLButtonElement;
  const select = document.getElementById('profile-select') as HTMLSelectElement;
  const name = document.getElementById('profile-name') as HTMLInputElement;
  select.innerHTML = '';
  for (const profile of state.profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = displayProfileName(profile.name);
    select.appendChild(option);
  }
  if (state.selectedProfileId) {
    select.value = state.selectedProfileId;
  }
  const profile = selectedProfile();
  name.value = profile?.name ?? '';
  bulkValid = profile ? isValidBulkText(displayBulkText(profile)) : true;
  if (!bulkValid) {
    setError(INVALID_BULK);
  } else if (errorText === INVALID_BULK) {
    setError('');
  }
  syncPopupShell(
    {
      app,
      apply,
      deleteBtn: del,
      newProfile: document.getElementById('btn-new-profile') as HTMLButtonElement,
    },
    state.profiles.length,
    !bulkValid,
    profile !== null,
  );
  syncBulkTextarea();
}

async function init(): Promise<void> {
  state = await loadStorage();
  bulkValid = true;
  render();

  document.getElementById('btn-new-profile')?.addEventListener('click', async () => {
    const result = createProfile(state.profiles);
    state = { profiles: result.profiles, selectedProfileId: result.created.id };
    bulkValid = true;
    if (errorText === INVALID_BULK) {
      setError('');
    }
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('btn-delete')?.addEventListener('click', async () => {
    if (!state.selectedProfileId) {
      return;
    }
    const result = deleteProfile(state.profiles, state.selectedProfileId, state.selectedProfileId);
    state = result;
    bulkValid = true;
    if (errorText === INVALID_BULK) {
      setError('');
    }
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('profile-select')?.addEventListener('change', async (event) => {
    state.selectedProfileId = (event.target as HTMLSelectElement).value;
    bulkValid = true;
    if (errorText === INVALID_BULK) {
      setError('');
    }
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('profile-name')?.addEventListener('input', async (event) => {
    const profile = selectedProfile();
    if (!profile) {
      return;
    }
    profile.name = (event.target as HTMLInputElement).value;
    clearApplyError();
    await persist();
    const select = document.getElementById('profile-select') as HTMLSelectElement;
    const option = Array.from(select.options).find((item) => item.value === profile.id);
    if (option) {
      option.textContent = displayProfileName(profile.name);
    }
  });

  document.getElementById('bulk-text')?.addEventListener('input', async (event) => {
    const raw = (event.target as HTMLTextAreaElement).value;
    const profile = selectedProfile();
    if (!profile) {
      return;
    }
    const result = applyBulkInput(profile, raw);
    profile.bulkText = result.profile.bulkText;
    profile.params = result.profile.params;
    bulkValid = result.bulkValid;
    if (!result.bulkValid) {
      setError(INVALID_BULK);
    } else if (errorText === INVALID_BULK) {
      setError('');
    }
    clearApplyError();
    await persist();
    (document.getElementById('btn-apply') as HTMLButtonElement).disabled = isApplyDisabled(
      state.profiles.length,
      !bulkValid,
    );
  });

  document.getElementById('btn-apply')?.addEventListener('click', async () => {
    const profile = selectedProfile();
    if (!profile) {
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setError(APPLY_NOT_PROJECT);
      return;
    }
    const decided = decideApplyUrl(tab.url, profile.params);
    if ('error' in decided) {
      setError(decided.error);
      return;
    }
    setError('');
    await chrome.tabs.update(tab.id, { url: decided.url });
  });
}

void init();
