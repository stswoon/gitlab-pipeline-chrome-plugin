// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isFormReady, isInputsSectionSettled } from './wait';

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
