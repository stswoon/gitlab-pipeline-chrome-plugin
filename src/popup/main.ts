import { loadStorage } from './storage';

async function init(): Promise<void> {
  const state = await loadStorage();
  const app = document.getElementById('app');
  const apply = document.getElementById('btn-apply');
  if (!(app instanceof HTMLElement) || !(apply instanceof HTMLButtonElement)) {
    return;
  }
  const empty = state.profiles.length === 0;
  app.classList.toggle('is-empty', empty);
  apply.disabled = empty;
}

void init();
