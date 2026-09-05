import {setNativeValue, sleep, textOf} from './dom';
import {isSpinnerVisible} from './wait';

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
        doc.querySelectorAll<HTMLElement>('[role="option"], li.gl-new-dropdown-item, [data-testid^="listbox-item-"]')
    ).filter((el) => {
        const style = el.ownerDocument.defaultView?.getComputedStyle(el);
        return !style || style.display !== 'none';
    });
}

export function pickOption(items: HTMLElement[], wanted: string): HTMLElement | null {
    const mapped = items.map((el) => ({el, value: optionValue(el), label: textOf(el)}));
    const picked = pickOptionLike(
        mapped.map((item) => ({value: item.value, label: item.label})),
        wanted,
    );
    if (!picked) {
        return null;
    }
    return mapped.find((item) => item.value === picked.value && item.label === picked.label)?.el ?? null;
}

const SEARCH_INPUT_SELECTOR = '.gl-new-dropdown input, [data-testid="listbox-search-input"], input[placeholder="Search refs"]';

function dropdownRoot(toggle: HTMLElement): Element {
    return toggle.closest('.gl-new-dropdown, .ref-selector, fieldset') ?? toggle.ownerDocument.body;
}

function pickReadyOption(doc: Document, wanted: string, root: Element): HTMLElement | null {
    if (isSpinnerVisible(root)) {
        return null;
    }
    return pickOption(collectListboxItems(doc), wanted);
}

function waitForReadyOption(
    doc: Document,
    wanted: string,
    root: Element,
    timeoutMs: number,
): Promise<HTMLElement | null> {
    const immediate = pickReadyOption(doc, wanted, root);
    if (immediate) {
        return Promise.resolve(immediate);
    }
    return new Promise((resolve) => {
        let observer: MutationObserver;
        const timer = window.setTimeout(() => {
            observer.disconnect();
            resolve(pickReadyOption(doc, wanted, root));
        }, timeoutMs);
        observer = new MutationObserver(() => {
            const found = pickReadyOption(doc, wanted, root);
            if (found) {
                window.clearTimeout(timer);
                observer.disconnect();
                resolve(found);
            }
        });
        observer.observe(doc.body, {childList: true, subtree: true, attributes: true});
    });
}

export async function selectListboxOption(toggle: HTMLElement, wanted: string, search: boolean,): Promise<boolean> {
    const doc = toggle.ownerDocument;
    const root = dropdownRoot(toggle);
    toggle.click();
    await sleep(50);
    let match = await waitForReadyOption(doc, wanted, root, 2_000);
    if (!match && search) {
        const searchInput =
            root.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR) ??
            doc.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR);
        if (searchInput) {
            setNativeValue(searchInput, wanted);
            match = await waitForReadyOption(doc, wanted, root, 15_000);
        }
    }
    if (!match) {
        toggle.click();
        await sleep(50);
        return false;
    }
    match.click();
    await sleep(50);
    return true;
}

export type OptionLike = { value: string; label: string };

export function pickOptionLike(items: OptionLike[], wanted: string): OptionLike | null {
    const byValue = items.find((item) => item.value === wanted);
    const byLabel = items.find((item) => item.label === wanted);
    if (byValue) {
        return byValue;
    }
    return byLabel ?? null;
}
