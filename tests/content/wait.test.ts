// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { findBranchToggle, isFormReady, isInputsSectionSettled } from '../../src/content/wait';

function pipelineFormShell(extra = ''): string {
  return `
    <form>
      <h1>Run new pipeline</h1>
      <div class="gl-form-group">
        <label>Run for branch name or tag</label>
        <button type="button">main</button>
      </div>
      <section>
        <h3>Variables</h3>
        <div data-testid="ci-variable-row-container">
          <input data-testid="pipeline-form-ci-variable-key-field" value="" />
          <input data-testid="pipeline-form-ci-variable-value-field" value="" />
        </div>
      </section>
      ${extra}
    </form>
  `;
}

describe('isInputsSectionSettled', () => {
  it('is false when only a Variables table is present under Inputs heading', () => {
    document.body.innerHTML = pipelineFormShell(`
      <section>
        <h3>Inputs</h3>
        <table><tr><td>Variables-looking table</td></tr></table>
      </section>
    `);
    expect(isInputsSectionSettled(document)).toBe(false);
    expect(isFormReady(document)).toBe(false);
  });

  it('is true when input-row markers exist alongside branch and variables', () => {
    document.body.innerHTML = pipelineFormShell(`
      <section>
        <h3>Inputs</h3>
        <table data-testid="input-row">
          <tr><td>myinput</td><td></td><td>String</td><td><input type="text" /></td></tr>
        </table>
      </section>
    `);
    expect(isInputsSectionSettled(document)).toBe(true);
    expect(isFormReady(document)).toBe(true);
  });
});

describe('findBranchToggle', () => {
  it('finds the ref listbox when GitLab uses legend in a fieldset', () => {
    document.body.innerHTML = `
      <main>
        <div>
          <h1>Run new pipeline</h1>
        </div>
        <fieldset class="form-group gl-form-group">
          <legend>Run for branch name or tag</legend>
          <button type="button" data-testid="base-dropdown-toggle">main</button>
        </fieldset>
        <section>
          <h3>Variables</h3>
          <div data-testid="ci-variable-row-container">
            <input data-testid="pipeline-form-ci-variable-key-field" value="" />
          </div>
        </section>
        <section>
          <h3>Inputs</h3>
          <table>
            <tr data-testid="input-row"><td>email</td></tr>
          </table>
        </section>
      </main>
    `;
    const toggle = findBranchToggle(document);
    expect(toggle?.getAttribute('data-testid')).toBe('base-dropdown-toggle');
    expect(isFormReady(document)).toBe(true);
  });
});
