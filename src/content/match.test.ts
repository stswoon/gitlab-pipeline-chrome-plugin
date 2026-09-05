import { describe, expect, it } from 'vitest';
import { hasQueryParams, isRunNewPipelinePage } from './match';

describe('isRunNewPipelinePage', () => {
  it('matches http(s) hosts that contain gitlab, case-insensitively', () => {
    expect(
      isRunNewPipelinePage({
        protocol: 'https:',
        hostname: 'gitlab.com',
        pathname: '/acme/app/-/pipelines/new',
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

  it('rejects non-gitlab hosts, wrong protocol, and longer suffixes', () => {
    expect(
      isRunNewPipelinePage({
        protocol: 'https:',
        hostname: 'example.com',
        pathname: '/foo/-/pipelines/new',
        search: '',
      }),
    ).toBe(false);
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
