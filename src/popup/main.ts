import { addEmptyRow, createProfile, deleteProfile, removeRowAt, tryUpdateRowKey, updateRowValue } from '../shared/profiles';
import type { Profile, StorageShape } from '../shared/query';
import { loadStorage, saveStorage } from './storage';
import { displayProfileName, isApplyDisabled } from './ui-state';

const APPLY_NOT_PROJECT =
  'This tab is not a GitLab project. Open a project page and try Apply again.';
const DUPLICATE_KEY = 'Keys must be unique.';

let state: StorageShape = { profiles: [], selectedProfileId: null };
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

function renderRows(): void {
  const list = document.getElementById('rows-list') as HTMLElement;
  list.replaceChildren();
  const profile = selectedProfile();
  if (!profile) {
    return;
  }
  profile.params.forEach((param, index) => {
    const row = document.createElement('div');
    row.className = 'kv-row';

    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.value = param.key;
    keyInput.setAttribute('aria-label', 'Key');
    keyInput.addEventListener('input', async () => {
      const result = tryUpdateRowKey(profile.params, index, keyInput.value);
      if (result.error) {
        keyInput.value = profile.params[index]!.key;
        setError(result.error);
        return;
      }
      profile.params = result.params;
      if (errorText === DUPLICATE_KEY) {
        setError('');
      }
      clearApplyError();
      await persist();
    });

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.value = param.value;
    valueInput.setAttribute('aria-label', 'Value');
    valueInput.addEventListener('input', async () => {
      profile.params = updateRowValue(profile.params, index, valueInput.value);
      clearApplyError();
      await persist();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      profile.params = removeRowAt(profile.params, index);
      clearApplyError();
      await persist();
      render();
    });

    row.append(keyInput, valueInput, remove);
    list.appendChild(row);
  });
}

function render(): void {
  const app = document.getElementById('app') as HTMLElement;
  const apply = document.getElementById('btn-apply') as HTMLButtonElement;
  const del = document.getElementById('btn-delete') as HTMLButtonElement;
  const select = document.getElementById('profile-select') as HTMLSelectElement;
  const name = document.getElementById('profile-name') as HTMLInputElement;
  const empty = state.profiles.length === 0;
  app.classList.toggle('is-empty', empty);
  apply.disabled = isApplyDisabled(state.profiles.length, false);
  del.disabled = selectedProfile() === null;
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
  name.value = selectedProfile()?.name ?? '';
  renderRows();
}

async function init(): Promise<void> {
  state = await loadStorage();
  render();

  document.getElementById('btn-new-profile')?.addEventListener('click', async () => {
    const result = createProfile(state.profiles);
    state = { profiles: result.profiles, selectedProfileId: result.created.id };
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
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('profile-select')?.addEventListener('change', async (event) => {
    state.selectedProfileId = (event.target as HTMLSelectElement).value;
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

  document.getElementById('btn-add-row')?.addEventListener('click', async () => {
    const profile = selectedProfile();
    if (!profile) {
      return;
    }
    profile.params = addEmptyRow(profile.params);
    clearApplyError();
    await persist();
    render();
  });
}

void init();
