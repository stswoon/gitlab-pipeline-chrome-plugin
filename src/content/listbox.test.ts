// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { selectListboxOption } from './listbox';

function listboxFixture(optionsHtml: string): {
  toggle: HTMLElement;
  option: HTMLElement | null;
  search: HTMLInputElement;
} {
  document.body.innerHTML = `
    <div class="ref-selector gl-new-dropdown">
      <button type="button" class="gl-new-dropdown-toggle">main</button>
      <input data-testid="listbox-search-input" placeholder="Search refs" />
      <ul>${optionsHtml}</ul>
    </div>
  `;
  return {
    toggle: document.querySelector('button') as HTMLElement,
    option: document.querySelector('[role="option"]'),
    search: document.querySelector('input') as HTMLInputElement,
  };
}

describe('selectListboxOption', () => {
  it('clicks an already-visible option before search can replace the list with a spinner', async () => {
    const { toggle, option, search } = listboxFixture(
      '<li role="option" data-testid="listbox-item-refs/heads/test">test</li>',
    );
    let clicked = false;
    option?.addEventListener('click', () => {
      clicked = true;
    });
    search.addEventListener('input', () => {
      option?.remove();
    });

    const ok = await selectListboxOption(toggle, 'test', true);

    expect(ok).toBe(true);
    expect(clicked).toBe(true);
  });

  it('waits through a search spinner until the matching option appears', async () => {
    const { toggle, search } = listboxFixture('');
    const list = document.querySelector('ul') as HTMLElement;
    let clicked = false;
    search.addEventListener('input', () => {
      list.innerHTML = '<div class="gl-spinner"></div>';
      window.setTimeout(() => {
        list.innerHTML = '<li role="option" data-testid="listbox-item-refs/heads/test">test</li>';
        document.querySelector('[role="option"]')?.addEventListener('click', () => {
          clicked = true;
        });
      }, 600);
    });

    const ok = await selectListboxOption(toggle, 'test', true);

    expect(ok).toBe(true);
    expect(clicked).toBe(true);
  });

  it('waits for options that mount after open instead of searching immediately', async () => {
    const { toggle, search } = listboxFixture('');
    const list = document.querySelector('ul') as HTMLElement;
    let clicked = false;
    let searched = false;
    toggle.addEventListener('click', () => {
      window.setTimeout(() => {
        list.innerHTML = '<li role="option" data-testid="listbox-item-refs/heads/test">test</li>';
        document.querySelector('[role="option"]')?.addEventListener('click', () => {
          clicked = true;
        });
      }, 200);
    });
    search.addEventListener('input', () => {
      searched = true;
      list.innerHTML = '';
    });

    const ok = await selectListboxOption(toggle, 'test', true);

    expect(ok).toBe(true);
    expect(clicked).toBe(true);
    expect(searched).toBe(false);
  });
});
