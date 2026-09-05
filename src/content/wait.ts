import {textOf} from './dom';

export function findPipelineFormRegion(doc: Document): HTMLElement | null {
    const heading = Array.from(doc.querySelectorAll('h1')).find((el) => textOf(el) === 'Run new pipeline');
    if (heading) {
        const form = heading.closest('form');
        if (form instanceof HTMLElement) {
            return form;
        }
        const main = heading.closest('main, .content-wrapper, [role="main"]');
        if (main instanceof HTMLElement) {
            return main;
        }
    }
    return null;
}

function region(doc: Document): HTMLElement {
    return findPipelineFormRegion(doc) ?? doc.body;
}

export function findBranchToggle(doc: Document): HTMLElement | null {
    for (const label of Array.from(region(doc).querySelectorAll('label, legend'))) {
        if (textOf(label) === 'Run for branch name or tag') {
            const group = label.closest('.gl-form-group, .form-group, fieldset') ?? label.parentElement;
            const button = group?.querySelector('button');
            if (button instanceof HTMLElement) {
                return button;
            }
        }
    }
    return null;
}

export function isVariablesSectionExist(doc: Document): boolean {
    const root = region(doc);
    const row = root.querySelector('[data-testid="ci-variable-row-container"]');
    if (row instanceof HTMLElement) {
        return true;
    }
    return false;
}

export function isInputsSectionSettled(doc: Document): boolean {
    const root = region(doc);
    if (root.querySelector('[data-testid="input-row"]')) {
        return true;
    }

    const noInputs = Array.from(root.querySelectorAll('.crud-body'))
        .some((el) => /there are no inputs/i.test(textOf(el)));
    if (noInputs) {
        return true;
    }

    return false;
}

function isFormReady(doc: Document): boolean {
    if (!findBranchToggle(doc)) {
        return false;
    }
    if (!isVariablesSectionExist(doc)) {
        return false;
    }
    if (!isInputsSectionSettled(doc)) {
        return false;
    }
    return true;
}

export function waitForForm(doc: Document, timeoutMs = 15_000): Promise<boolean> {
    if (isFormReady(doc)) {
        return Promise.resolve(true);
    }

    return new Promise((resolve) => {
        let observer: MutationObserver;
        const timer = window.setTimeout(() => {
            observer.disconnect();
            resolve(false);
        }, timeoutMs);
        observer = new MutationObserver(() => {
            if (isFormReady(doc)) {
                window.clearTimeout(timer);
                observer.disconnect();
                resolve(true);
            }
        });
        observer.observe(doc.body, {childList: true, subtree: true});
    });
}

export function isSpinnerVisible(regionEl: Element): boolean {
    const nodes = regionEl.querySelectorAll(
        '.gl-spinner, .gl-loading-icon, [class*="skeleton"], [aria-busy="true"]',
    );
    return Array.from(nodes).some((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    });
}

export function waitForStabilize(
    formRegion: Element,
    timeoutMs = 15_000,
    quietMs = 400,
): Promise<void> {
    return new Promise((resolve) => {
        let quietTimer = 0;
        const finish = (): void => {
            window.clearTimeout(deadline);
            window.clearTimeout(quietTimer);
            observer.disconnect();
            resolve();
        };
        const armQuiet = (): void => {
            window.clearTimeout(quietTimer);
            quietTimer = window.setTimeout(() => {
                if (!isSpinnerVisible(formRegion)) {
                    finish();
                } else {
                    armQuiet();
                }
            }, quietMs);
        };
        const deadline = window.setTimeout(finish, timeoutMs);
        const observer = new MutationObserver(() => {
            armQuiet();
        });
        observer.observe(formRegion, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
        });
        if (!isSpinnerVisible(formRegion)) {
            armQuiet();
        }
    });
}
