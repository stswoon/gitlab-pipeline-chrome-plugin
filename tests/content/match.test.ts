import { describe, expect, it } from 'vitest';
import { hasQueryParams, isRunNewPipelinePage } from '../../src/content/match';

describe('isRunNewPipelinePage', () => {
  it('matches http(s) paths ending in /-/pipelines/new regardless of host', () => {
    expect(
      isRunNewPipelinePage({
        protocol: 'https:',
        hostname: 'git.acme.com',
        pathname: '/group/proj/-/pipelines/new',
        search: '',
      }),
    ).toBe(true);
    expect(
      isRunNewPipelinePage({
        protocol: 'https:',
        hostname: 'code.acme.com',
        pathname: '/g/p/-/pipelines/new/',
        search: '',
      }),
    ).toBe(true);
    expect(
      isRunNewPipelinePage({
        protocol: 'https:',
        hostname: 'example.com',
        pathname: '/foo/-/pipelines/new',
        search: '',
      }),
    ).toBe(true);
    expect(
      isRunNewPipelinePage({
        protocol: 'http:',
        hostname: 'GitLab.example.com',
        pathname: '/g/p/-/pipelines/new/',
        search: '',
      }),
    ).toBe(true);
  });

  it('rejects wrong protocol, longer suffixes, and paths without /new', () => {
    expect(
      isRunNewPipelinePage({
        protocol: 'file:',
        hostname: 'gitlab.com',
        pathname: '/acme/app/-/pipelines/new',
        search: '',
      }),
    ).toBe(false);
    expect(
      isRunNewPipelinePage({
        protocol: 'https:',
        hostname: 'gitlab.com',
        pathname: '/acme/app/-/pipelines/new/foo',
        search: '',
      }),
    ).toBe(false);
    expect(
      isRunNewPipelinePage({
        protocol: 'https:',
        hostname: 'gitlab.com',
        pathname: '/acme/app/-/pipelines',
        search: '',
      }),
    ).toBe(false);
  });
});

describe('hasQueryParams', () => {
  it('is false for empty search', () => {
    expect(hasQueryParams('')).toBe(false);
    expect(hasQueryParams('?')).toBe(false);
  });

  it('is true when URLSearchParams has entries', () => {
    expect(hasQueryParams('?_branch=main')).toBe(true);
    expect(hasQueryParams('a=1')).toBe(true);
  });
});
