// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { syncPopupShell } from './ui-state';

function shellElements(): {
  app: HTMLElement;
  apply: HTMLButtonElement;
  deleteBtn: HTMLButtonElement;
  newProfile: HTMLButtonElement;
} {
  document.body.innerHTML = `
    <div id="app">
      <button id="btn-new-profile" type="button">New profile</button>
      <button id="btn-delete" type="button">Delete</button>
      <button id="btn-apply" type="button">Apply</button>
    </div>
  `;
  return {
    app: document.getElementById('app') as HTMLElement,
    newProfile: document.getElementById('btn-new-profile') as HTMLButtonElement,
    deleteBtn: document.getElementById('btn-delete') as HTMLButtonElement,
    apply: document.getElementById('btn-apply') as HTMLButtonElement,
  };
}

describe('syncPopupShell', () => {
  it('leaves only New profile actionable when there are zero profiles', () => {
    const els = shellElements();
    syncPopupShell(els, 0, false, false);
    expect(els.app.classList.contains('is-empty')).toBe(true);
    expect(els.apply.disabled).toBe(true);
    expect(els.deleteBtn.disabled).toBe(true);
    expect(els.newProfile.disabled).toBe(false);
  });

  it('enables Apply when a profile exists and bulk text is valid', () => {
    const els = shellElements();
    syncPopupShell(els, 1, false, true);
    expect(els.app.classList.contains('is-empty')).toBe(false);
    expect(els.apply.disabled).toBe(false);
    expect(els.deleteBtn.disabled).toBe(false);
  });
});
