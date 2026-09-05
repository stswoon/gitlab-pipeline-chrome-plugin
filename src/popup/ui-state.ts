export function displayProfileName(name: string): string {
  return name === '' ? 'Untitled' : name;
}

export function isApplyDisabled(profileCount: number, bulkInvalid: boolean): boolean {
  return profileCount === 0 || bulkInvalid;
}

export type PopupShellElements = {
  app: HTMLElement;
  apply: HTMLButtonElement;
  deleteBtn: HTMLButtonElement;
  newProfile: HTMLButtonElement;
};

export function syncPopupShell(
  els: PopupShellElements,
  profileCount: number,
  bulkInvalid: boolean,
  hasSelection: boolean,
): void {
  const empty = profileCount === 0;
  els.app.classList.toggle('is-empty', empty);
  els.apply.disabled = isApplyDisabled(profileCount, bulkInvalid);
  els.deleteBtn.disabled = !hasSelection;
}
