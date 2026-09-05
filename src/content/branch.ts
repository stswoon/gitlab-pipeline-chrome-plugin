import { textOf } from './dom';
import { selectListboxOption } from './listbox';
import { findBranchToggle, findPipelineFormRegion, waitForStabilize } from './wait';

function branchAlreadyMatches(toggle: HTMLElement, wanted: string): boolean {
  if (textOf(toggle) === wanted) {
    return true;
  }
  const value = toggle.getAttribute('data-value') ?? '';
  return value === wanted;
}

export async function setBranchIfNeeded(doc: Document, wanted: string): Promise<boolean> {
  const toggle = findBranchToggle(doc);
  if (!toggle) {
    return false;
  }
  if (branchAlreadyMatches(toggle, wanted)) {
    return false;
  }
  const changed = await selectListboxOption(toggle, wanted, true);
  if (!changed) {
    return false;
  }
  const formRegion = findPipelineFormRegion(doc);
  if (formRegion) {
    await waitForStabilize(formRegion, 15_000, 400);
  }
  return true;
}
