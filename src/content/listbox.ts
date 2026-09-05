import { setNativeValue, sleep, textOf } from './dom';
import { pickOptionLike } from './listbox-pick';

export function optionValue(el: HTMLElement): string {
  const testid = el.getAttribute('data-testid') ?? '';
  const match = /^listbox-item-(.*)$/.exec(testid);
  if (match) {
    return match[1] ?? '';
  }
  return el.getAttribute('data-value') ?? '';
}

export function collectListboxItems(doc: Document): HTMLElement[] {
  return Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[role="option"], li.gl-new-dropdown-item, [data-testid^="listbox-item-"]',
    ),
  ).filter((el) => {
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    return !style || style.display !== 'none';
  });
}

export function pickOption(items: HTMLElement[], wanted: string): HTMLElement | null {
  const mapped = items.map((el) => ({ el, value: optionValue(el), label: textOf(el) }));
  const picked = pickOptionLike(
    mapped.map((item) => ({ value: item.value, label: item.label })),
    wanted,
  );
  if (!picked) {
    return null;
  }
  return mapped.find((item) => item.value === picked.value && item.label === picked.label)?.el ?? null;
}

export async function selectListboxOption(
  toggle: HTMLElement,
  wanted: string,
  search: boolean,
): Promise<boolean> {
  const doc = toggle.ownerDocument;
  toggle.click();
  await sleep(50);
  if (search) {
    const searchInput = doc.querySelector<HTMLInputElement>(
      '.gl-new-dropdown input, [data-testid="listbox-search-input"], input[placeholder="Search refs"]',
    );
    if (searchInput) {
      setNativeValue(searchInput, wanted);
      await sleep(400);
    }
  }
  const match = pickOption(collectListboxItems(doc), wanted);
  if (!match) {
    toggle.click();
    await sleep(50);
    return false;
  }
  match.click();
  await sleep(50);
  return true;
}
