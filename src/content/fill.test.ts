// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { Param } from '../shared/query';
import { textOf } from './dom';
import { fillForm } from './fill';
import * as widgets from './widgets';

function pipelineFixture(extra = ''): void {
  document.body.innerHTML = `
    <form>
      <h1>Run new pipeline</h1>
      <div class="gl-form-group">
        <label>Run for branch name or tag</label>
        <button type="button">main</button>
      </div>
      <section>
        <h3>Variables</h3>
        <div data-testid="ci-variable-row-container">
          <span data-testid="pipeline-form-ci-variable-type">Variable</span>
          <input data-testid="pipeline-form-ci-variable-key-field" value="" />
          <input data-testid="pipeline-form-ci-variable-value-field" value="" />
        </div>
      </section>
      <section>
        <h3>Inputs</h3>
        <table>
          <tr data-testid="input-row">
            <td>email</td>
            <td></td>
            <td>String</td>
            <td><input type="text" /></td>
          </tr>
        </table>
      </section>
      ${extra}
    </form>
  `;
}

function variableKeyInputs(): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('[data-testid="pipeline-form-ci-variable-key-field"]'),
  );
}

describe('fillForm cascade', () => {
  it('fills a matching input row and does not create a CI variable of that name', async () => {
    pipelineFixture();
    await fillForm(document, [{ key: 'email', value: 'a@b.c' }]);
    const input = document.querySelector(
      '[data-testid="input-row"] input[type="text"]',
    ) as HTMLInputElement;
    expect(input.value).toBe('a@b.c');
    expect(variableKeyInputs().some((el) => el.value === 'email')).toBe(false);
  });

  it('creates a variable for an unknown key via the empty variable row', async () => {
    pipelineFixture();
    await fillForm(document, [{ key: 'NEW_VAR', value: 'secret' }]);
    const keys = variableKeyInputs().map((el) => el.value);
    expect(keys).toContain('NEW_VAR');
    const row = keys.indexOf('NEW_VAR');
    const values = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        '[data-testid="pipeline-form-ci-variable-value-field"]',
      ),
    );
    expect(values[row]?.value).toBe('secret');
  });

  it('skips file variable rows when updating existing variables', async () => {
    pipelineFixture(`
      <div data-testid="ci-variable-row-container">
        <span data-testid="pipeline-form-ci-variable-type">File</span>
        <input data-testid="pipeline-form-ci-variable-key-field" value="TOKEN" />
        <input data-testid="pipeline-form-ci-variable-value-field" value="old" />
      </div>
    `);
    await fillForm(document, [{ key: 'TOKEN', value: 'new' }]);
    const fileRow = Array.from(document.querySelectorAll('[data-testid="ci-variable-row-container"]'))
      .find((row) =>
        row.querySelector('[data-testid="pipeline-form-ci-variable-key-field"]')?.getAttribute('value') ===
        'TOKEN',
      );
    const valueEl = fileRow?.querySelector(
      '[data-testid="pipeline-form-ci-variable-value-field"]',
    ) as HTMLInputElement;
    expect(valueEl?.value).toBe('old');
  });

  it('skips reserved and empty keys', async () => {
    pipelineFixture(`
      <table>
        <tr data-testid="input-row">
          <td>_hidden</td><td></td><td>String</td><td><input type="text" /></td>
        </tr>
      </table>
    `);
    await fillForm(document, [
      { key: '_branch', value: 'dev' },
      { key: '_secret', value: 'x' },
      { key: '', value: 'skip' },
    ]);
    expect(variableKeyInputs().every((el) => el.value === '')).toBe(true);
    const branchToggle = document.querySelector('.gl-form-group button');
    expect(branchToggle?.textContent?.trim()).toBe('main');
  });

  it('continues filling later keys when one widget throws', async () => {
    pipelineFixture(`
      <table>
        <tr data-testid="input-row">
          <td>bad</td><td></td><td>String</td><td><input type="text" /></td>
        </tr>
        <tr data-testid="input-row">
          <td>good</td><td></td><td>String</td><td><input type="text" /></td>
        </tr>
      </table>
    `);
    const originalApply = widgets.applyInputWidget;
    vi.spyOn(widgets, 'applyInputWidget').mockImplementation(async (row, raw) => {
      if (textOf(row.querySelector('td')).startsWith('bad')) {
        throw new Error('boom');
      }
      return originalApply(row, raw);
    });
    const goodRow = Array.from(document.querySelectorAll('[data-testid="input-row"]')).find(
      (row) => textOf(row.querySelector('td')).startsWith('good'),
    );
    const goodField = goodRow?.querySelector('input') as HTMLInputElement;
    const params: Param[] = [
      { key: 'bad', value: 'x' },
      { key: 'good', value: 'ok' },
    ];
    await expect(fillForm(document, params)).resolves.toBeUndefined();
    expect(goodField.value).toBe('ok');
    vi.restoreAllMocks();
  });
});
