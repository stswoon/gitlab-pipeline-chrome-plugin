import { setNativeValue, sleep, textOf } from './dom';
import { collectListboxItems, optionValue, selectListboxOption } from './listbox';

export function findInputRow(doc: Document, name: string): HTMLElement | null {
  for (const row of Array.from(doc.querySelectorAll<HTMLElement>('[data-testid="input-row"]'))) {
    const nameCell = row.querySelector('td');
    if (!nameCell) {
      continue;
    }
    const clone = nameCell.cloneNode(true) as HTMLElement;
    clone.querySelector('[data-testid="required-asterisk"]')?.remove();
    if (textOf(clone) === name) {
      return row;
    }
  }
  return null;
}

function typeFromRow(row: HTMLElement): string | null {
  const cells = row.querySelectorAll('td');
  if (cells.length >= 3) {
    const typeText = textOf(cells[2]!);
    return typeText === '' ? null : typeText.toLowerCase();
  }
  return null;
}

function valueCell(row: HTMLElement): HTMLElement | null {
  const cells = row.querySelectorAll('td');
  return cells.length === 0 ? null : (cells[cells.length - 1] as HTMLElement);
}

function inferType(cell: HTMLElement): string {
  if (cell.querySelector('input[type="checkbox"], [role="switch"]')) {
    return 'boolean';
  }
  if (cell.querySelector('[aria-multiselectable="true"]')) {
    return 'list';
  }
  if (cell.querySelector('input[type="number"]')) {
    return 'number';
  }
  if (cell.querySelector('.gl-new-dropdown, [role="listbox"]')) {
    return 'dropdown';
  }
  return 'text';
}

function dropdownToggle(cell: HTMLElement): HTMLElement | null {
  return cell.querySelector<HTMLElement>(
    'button.gl-new-dropdown-toggle, button[data-testid="base-dropdown-toggle"], .gl-new-dropdown button',
  );
}

async function applyMultiSelect(toggle: HTMLElement, raw: string): Promise<boolean> {
  const doc = toggle.ownerDocument;
  toggle.click();
  await sleep(50);
  const items = collectListboxItems(doc);
  const options = items.map((item) => optionValue(item) || textOf(item));
  const desired = listSelection(raw, options);
  for (const item of items) {
    const token = optionValue(item) || textOf(item);
    const should = desired.includes(token);
    const checkbox = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const selected = item.getAttribute('aria-selected') === 'true' || checkbox?.checked === true;
    if (should !== selected) {
      item.click();
      await sleep(20);
    }
  }
  toggle.click();
  await sleep(50);
  return true;
}

export async function applyInputWidget(row: HTMLElement, raw: string): Promise<boolean> {
  const cell = valueCell(row);
  if (!cell) {
    return false;
  }
  const declared = typeFromRow(row);
  const kind = declared ?? inferType(cell);
  const checkbox = cell.querySelector<HTMLInputElement>('input[type="checkbox"]');
  const toggleSwitch = cell.querySelector<HTMLButtonElement>('[role="switch"]');
  const numberInput = cell.querySelector<HTMLInputElement>('input[type="number"]');
  const textarea = cell.querySelector<HTMLTextAreaElement>('textarea');
  const textInput = cell.querySelector<HTMLInputElement>(
    'input[type="text"], input:not([type]), input[type="search"]',
  );
  const boolButtons = Array.from(cell.querySelectorAll('button')).filter((button) => {
    const label = textOf(button).toLowerCase();
    return label === 'true' || label === 'false';
  });
  const listToggle = dropdownToggle(cell);

  if (kind === 'boolean' || checkbox || toggleSwitch || boolButtons.length >= 2) {
    const parsed = parseBooleanQuery(raw);
    if (parsed === null) {
      return false;
    }
    if (checkbox) {
      if (checkbox.checked !== parsed) {
        checkbox.click();
      }
      return true;
    }
    if (toggleSwitch) {
      const on = toggleSwitch.getAttribute('aria-checked') === 'true';
      if (on !== parsed) {
        toggleSwitch.click();
      }
      return true;
    }
    if (boolButtons.length >= 2) {
      const target = boolButtons.find((button) => textOf(button).toLowerCase() === String(parsed));
      if (!target) {
        return false;
      }
      const already =
        target.getAttribute('aria-pressed') === 'true' || target.classList.contains('selected');
      if (!already) {
        target.click();
      }
      return true;
    }
    if (listToggle) {
      return selectListboxOption(listToggle, String(parsed), false);
    }
    return false;
  }

  if (kind === 'array' || kind === 'list' || cell.querySelector('[aria-multiselectable="true"]')) {
    if (!listToggle) {
      return false;
    }
    return applyMultiSelect(listToggle, raw);
  }

  if (listToggle) {
    if (raw === '') {
      listToggle.click();
      await sleep(50);
      const items = collectListboxItems(row.ownerDocument);
      const empty = items.find(
        (item) =>
          textOf(item) === '' ||
          (item.hasAttribute('data-value') && item.getAttribute('data-value') === ''),
      );
      if (!empty) {
        listToggle.click();
        return false;
      }
      empty.click();
      return true;
    }
    return selectListboxOption(listToggle, raw, false);
  }

  if (kind === 'number' || numberInput) {
    const el = numberInput ?? textInput;
    if (!el) {
      return false;
    }
    setNativeValue(el, raw);
    return true;
  }

  const el = textarea ?? textInput;
  if (!el) {
    return false;
  }
  setNativeValue(el, raw);
  return true;
}

function listSelection(raw: string, existingOptions: string[]): string[] {
    const tokens = splitListValues(raw);
    return existingOptions.filter((option) => tokens.includes(option));
}

function splitListValues(raw: string): string[] {
    return raw
        .split(',')
        .map((token) => token.trim())
        .filter((token) => token !== '');
}

function parseBooleanQuery(value: string): boolean | null {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
        return true;
    }
    if (normalized === 'false') {
        return false;
    }
    return null;
}

