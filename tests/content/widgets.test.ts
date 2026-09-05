// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { applyInputWidget, findInputRow } from '../../src/content/widgets';

function dropdownRow(optionsHtml: string): HTMLElement {
  document.body.innerHTML = `
    <table>
      <tr data-testid="input-row">
        <td>myinput<span data-testid="required-asterisk">*</span></td>
        <td></td>
        <td>String</td>
        <td>
          <div class="gl-new-dropdown">
            <button type="button" class="gl-new-dropdown-toggle">Pick</button>
          </div>
        </td>
      </tr>
    </table>
    <ul role="listbox">${optionsHtml}</ul>
  `;
  return document.querySelector('[data-testid="input-row"]') as HTMLElement;
}

describe('findInputRow', () => {
  it('strips required-asterisk from the name cell before matching', () => {
    document.body.innerHTML = `
      <table>
        <tr data-testid="input-row">
          <td>required<span data-testid="required-asterisk">*</span></td>
          <td></td>
          <td>String</td>
          <td><input type="text" /></td>
        </tr>
      </table>
    `;
    expect(findInputRow(document, 'required')).not.toBeNull();
    expect(findInputRow(document, 'required*')).toBeNull();
  });
});

describe('applyInputWidget empty dropdown', () => {
  it('does not click an option when labels are non-empty and data-value is absent', async () => {
    const row = dropdownRow(`
      <li role="option">Alpha</li>
      <li role="option">Beta</li>
    `);
    const clicks: HTMLElement[] = [];
    for (const el of Array.from(document.querySelectorAll('[role="option"]'))) {
      el.addEventListener('click', () => clicks.push(el as HTMLElement));
    }

    const ok = await applyInputWidget(row, '');
    expect(ok).toBe(false);
    expect(clicks).toHaveLength(0);
  });

  it('clicks the option with data-value="" for an empty query', async () => {
    const row = dropdownRow(`
      <li role="option">Alpha</li>
      <li role="option" data-value="">None</li>
    `);
    const clicks: HTMLElement[] = [];
    for (const el of Array.from(document.querySelectorAll('[role="option"]'))) {
      el.addEventListener('click', () => clicks.push(el as HTMLElement));
    }

    const ok = await applyInputWidget(row, '');
    expect(ok).toBe(true);
    expect(clicks).toHaveLength(1);
    expect(clicks[0]?.getAttribute('data-value')).toBe('');
  });

  it('clicks the option with empty visible text', async () => {
    const row = dropdownRow(`
      <li role="option">Alpha</li>
      <li role="option"> </li>
    `);
    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const emptyOption = options[1]!;
    emptyOption.textContent = '';
    const clicks: HTMLElement[] = [];
    for (const el of options) {
      el.addEventListener('click', () => clicks.push(el as HTMLElement));
    }

    const ok = await applyInputWidget(row, '');
    expect(ok).toBe(true);
    expect(clicks[0]).toBe(emptyOption);
  });
});

describe('applyInputWidget scalar kinds', () => {
  it('fills a string input', async () => {
    document.body.innerHTML = `
      <table>
        <tr data-testid="input-row">
          <td>title</td><td></td><td>String</td>
          <td><input type="text" /></td>
        </tr>
      </table>
    `;
    const row = document.querySelector('[data-testid="input-row"]') as HTMLElement;
    const input = row.querySelector('input') as HTMLInputElement;
    expect(await applyInputWidget(row, 'hello')).toBe(true);
    expect(input.value).toBe('hello');
  });

  it('fills a number input', async () => {
    document.body.innerHTML = `
      <table>
        <tr data-testid="input-row">
          <td>count</td><td></td><td>Number</td>
          <td><input type="number" /></td>
        </tr>
      </table>
    `;
    const row = document.querySelector('[data-testid="input-row"]') as HTMLElement;
    const input = row.querySelector('input') as HTMLInputElement;
    expect(await applyInputWidget(row, '42')).toBe(true);
    expect(input.value).toBe('42');
  });

  it('toggles a checkbox for boolean true/false', async () => {
    document.body.innerHTML = `
      <table>
        <tr data-testid="input-row">
          <td>enabled</td><td></td><td>Boolean</td>
          <td><input type="checkbox" /></td>
        </tr>
      </table>
    `;
    const row = document.querySelector('[data-testid="input-row"]') as HTMLElement;
    const input = row.querySelector('input') as HTMLInputElement;
    expect(await applyInputWidget(row, 'true')).toBe(true);
    expect(input.checked).toBe(true);
    expect(await applyInputWidget(row, 'false')).toBe(true);
    expect(input.checked).toBe(false);
  });
});
