import { textOf } from './dom';

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
  for (const label of Array.from(region(doc).querySelectorAll('label'))) {
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

export function findVariablesSection(doc: Document): HTMLElement | null {
  const root = region(doc);
  const row = root.querySelector('[data-testid="ci-variable-row-container"]');
  if (row instanceof HTMLElement) {
    return row;
  }
  const key = root.querySelector('[data-testid="pipeline-form-ci-variable-key-field"]');
  if (key instanceof HTMLElement) {
    return key;
  }
  return null;
}

export function isInputsHeadingPresent(doc: Document): boolean {
  return Array.from(
    region(doc).querySelectorAll('h2, h3, h4, .gl-heading, [class*="crud-title"], legend'),
  ).some((el) => textOf(el) === 'Inputs' || textOf(el).startsWith('Inputs'));
}

function inputsHeading(root: HTMLElement): HTMLElement | null {
  const found = Array.from(
    root.querySelectorAll('h2, h3, h4, .gl-heading, [class*="crud-title"], legend'),
  ).find((el) => textOf(el) === 'Inputs' || textOf(el).startsWith('Inputs'));
  return found instanceof HTMLElement ? found : null;
}

function inputsSectionRoot(heading: HTMLElement): HTMLElement {
  const scoped =
    heading.closest('section, fieldset, .gl-card, .card') ??
    heading.parentElement ??
    heading;
  return scoped instanceof HTMLElement ? scoped : heading;
}

export function isInputsSectionSettled(doc: Document): boolean {
  const root = region(doc);
  if (root.querySelector('[data-testid="input-row"]')) {
    return true;
  }
  if (root.querySelector('[data-testid="empty-selection-state"]')) {
    return true;
  }
  if (root.querySelector('[data-testid="no-inputs-empty-state"]')) {
    return true;
  }
  const heading = inputsHeading(root);
  if (!heading) {
    return false;
  }
  const section = inputsSectionRoot(heading);
  return Array.from(section.querySelectorAll('p, div')).some((el) =>
    /there are no inputs/i.test(textOf(el)),
  );
}

export function isFormReady(doc: Document): boolean {
  if (!findBranchToggle(doc)) {
    return false;
  }
  if (!findVariablesSection(doc)) {
    return false;
  }
  if (isInputsHeadingPresent(doc) && !isInputsSectionSettled(doc)) {
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
    observer.observe(doc.body, { childList: true, subtree: true });
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
