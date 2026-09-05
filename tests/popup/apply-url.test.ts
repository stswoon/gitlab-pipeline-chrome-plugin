import { describe, expect, it } from 'vitest';
import { APPLY_NOT_PROJECT, decideApplyUrl } from '../../src/popup/apply-url';

describe('decideApplyUrl', () => {
  it('builds a pipeline-new URL from a project tab', () => {
    expect(
      decideApplyUrl('https://gitlab.com/group/proj/-/merge_requests', [
        { key: '_branch', value: 'main' },
        { key: 'email', value: 'a@b.c' },
      ]),
    ).toEqual({
      url: 'https://gitlab.com/group/proj/-/pipelines/new?_branch=main&email=a%40b.c',
    });
  });

  it('returns the not-a-project error when the tab has no /-/ or no url', () => {
    expect(APPLY_NOT_PROJECT).toBe(
      'This tab is not a GitLab project. Open a project page and try Apply again.',
    );
    expect(decideApplyUrl(undefined, [{ key: 'a', value: '1' }])).toEqual({
      error: APPLY_NOT_PROJECT,
    });
    expect(decideApplyUrl('https://example.com', [{ key: 'a', value: '1' }])).toEqual({
      error: APPLY_NOT_PROJECT,
    });
    expect(decideApplyUrl('https://gitlab.com/dashboard', [{ key: 'a', value: '1' }])).toEqual({
      error: APPLY_NOT_PROJECT,
    });
  });
});
