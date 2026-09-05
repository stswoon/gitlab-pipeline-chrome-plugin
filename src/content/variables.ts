import { setNativeValue, sleep, textOf } from './dom';
import { selectListboxOption } from './listbox';
import { findPipelineFormRegion } from './wait';

export function variableRows(doc: Document): HTMLElement[] {
  return Array.from(doc.querySelectorAll<HTMLElement>('[data-testid="ci-variable-row-container"]'));
}

function keyInput(row: HTMLElement): HTMLInputElement | null {
  return row.querySelector('[data-testid="pipeline-form-ci-variable-key-field"]');
}

function valueInput(row: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  return row.querySelector(
    '[data-testid="pipeline-form-ci-variable-value-field"], [data-testid="pipeline-form-ci-variable-value-dropdown"] input, textarea',
  );
}

export function isFileVariableRow(row: HTMLElement): boolean {
  const typeEl = row.querySelector('[data-testid="pipeline-form-ci-variable-type"]');
  return textOf(typeEl).toLowerCase().includes('file');
}

export function findVariableRow(doc: Document, key: string): HTMLElement | null {
  for (const row of variableRows(doc)) {
    const input = keyInput(row);
    if (input && input.value === key) {
      return row;
    }
  }
  return null;
}

function findEmptyVariableRow(doc: Document): HTMLElement | null {
  for (const row of variableRows(doc)) {
    const input = keyInput(row);
    if (input && input.value === '') {
      return row;
    }
  }
  return null;
}

export async function setVariableRow(
  row: HTMLElement,
  key: string,
  value: string,
): Promise<boolean> {
  const keyEl = keyInput(row);
  if (!keyEl) {
    return false;
  }
  if (keyEl.value !== key) {
    setNativeValue(keyEl, key);
  }
  const dropToggle = row.querySelector<HTMLElement>(
    '[data-testid="pipeline-form-ci-variable-value-dropdown"] button',
  );
  if (dropToggle) {
    const selected = await selectListboxOption(dropToggle, value, true);
    if (selected) {
      return true;
    }
  }
  const valEl = valueInput(row);
  if (!valEl) {
    return false;
  }
  setNativeValue(valEl, value);
  return true;
}

export async function addVariable(doc: Document, key: string, value: string): Promise<void> {
  const empty = findEmptyVariableRow(doc);
  if (empty) {
    await setVariableRow(empty, key, value);
    return;
  }
  const root = findPipelineFormRegion(doc) ?? doc.body;
  const addButton = Array.from(root.querySelectorAll('button')).find((button) =>
    /add variable/i.test(textOf(button)),
  );
  if (addButton) {
    addButton.click();
    await sleep(80);
  }
  const row = findEmptyVariableRow(doc);
  if (row) {
    const ok = await setVariableRow(row, key, value);
    if (!ok) {
      return;
    }
  }
}
