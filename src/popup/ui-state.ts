export function displayProfileName(name: string): string {
  return name === '' ? 'Untitled' : name;
}

export function isApplyDisabled(profileCount: number, bulkInvalid: boolean): boolean {
  return profileCount === 0 || bulkInvalid;
}
