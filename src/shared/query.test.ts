import { describe, expect, it } from 'vitest';
import {
  buildPipelineNewUrl,
  isValidBulkText,
  parseQuery,
  projectBaseFromHref,
  serializeParams,
  splitListValues,
} from './query';

describe('parseQuery', () => {
  it('treats a leading ? as optional', () => {
    expect(parseQuery('?a=1')).toEqual(parseQuery('a=1'));
    expect(parseQuery('?a=1')).toEqual([{ key: 'a', value: '1' }]);
  });

  it('preserves left-to-right order', () => {
    expect(parseQuery('_branch=main&a=1&b=2')).toEqual([
      { key: '_branch', value: 'main' },
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
  });

  it('keeps _branch as a normal key', () => {
    expect(parseQuery('?_branch=main&a=1')).toEqual([
      { key: '_branch', value: 'main' },
      { key: 'a', value: '1' },
    ]);
  });

  it('uses last duplicate value and first-seen position', () => {
    expect(parseQuery('a=1&b=2&a=3')).toEqual([
      { key: 'a', value: '3' },
      { key: 'b', value: '2' },
    ]);
  });

  it('keeps empty values', () => {
    expect(parseQuery('a=')).toEqual([{ key: 'a', value: '' }]);
  });

  it('returns [] for empty input, ? only, or whitespace', () => {
    expect(parseQuery('')).toEqual([]);
    expect(parseQuery('?')).toEqual([]);
    expect(parseQuery('   ')).toEqual([]);
  });

  it('decodes + and %XX', () => {
    expect(parseQuery('a=hello+world&b=a%40b.c')).toEqual([
      { key: 'a', value: 'hello world' },
      { key: 'b', value: 'a@b.c' },
    ]);
  });

  it('does not throw on junk', () => {
    expect(() => parseQuery('%%%')).not.toThrow();
    expect(Array.isArray(parseQuery('%%%'))).toBe(true);
  });
});

describe('serializeParams', () => {
  it('emits a leading ? when there is at least one kept pair', () => {
    expect(
      serializeParams([
        { key: '_branch', value: 'main' },
        { key: 'a', value: '1' },
        { key: 'b', value: '2' },
        { key: 'c', value: '3' },
      ]),
    ).toBe('?_branch=main&a=1&b=2&c=3');
  });

  it('skips empty keys after trim and keeps empty values', () => {
    expect(
      serializeParams([
        { key: '', value: 'x' },
        { key: '  ', value: 'y' },
        { key: 'a', value: '' },
      ]),
    ).toBe('?a=');
  });

  it('returns "" when nothing is kept', () => {
    expect(serializeParams([])).toBe('');
    expect(serializeParams([{ key: '', value: 'x' }])).toBe('');
  });
});

describe('splitListValues', () => {
  it('splits on commas', () => {
    expect(splitListValues('web,api')).toEqual(['web', 'api']);
  });

  it('trims tokens', () => {
    expect(splitListValues('web, api')).toEqual(['web', 'api']);
  });

  it('keeps a single token', () => {
    expect(splitListValues('web')).toEqual(['web']);
  });

  it('returns [] for empty or only commas', () => {
    expect(splitListValues('')).toEqual([]);
    expect(splitListValues(',,,')).toEqual([]);
  });
});

describe('projectBaseFromHref', () => {
  it('slices a normal project URL at the first /-/ ', () => {
    expect(projectBaseFromHref('https://gitlab.com/acme/app/-/pipelines')).toBe(
      'https://gitlab.com/acme/app',
    );
  });

  it('keeps nested groups', () => {
    expect(projectBaseFromHref('https://gitlab.com/group/sub/proj/-/pipelines/new')).toBe(
      'https://gitlab.com/group/sub/proj',
    );
    expect(projectBaseFromHref('https://gitlab.com/a/b/c/-/pipelines/new')).toBe(
      'https://gitlab.com/a/b/c',
    );
  });

  it('keeps scheme host and port', () => {
    expect(projectBaseFromHref('https://gitlab.example.com:8443/g/p/-/jobs/1')).toBe(
      'https://gitlab.example.com:8443/g/p',
    );
  });

  it('ignores query and hash when finding /-/ ', () => {
    expect(projectBaseFromHref('https://gitlab.com/acme/app/-/pipelines/new?x=1#y')).toBe(
      'https://gitlab.com/acme/app',
    );
  });

  it('returns null when /-/ is missing', () => {
    expect(projectBaseFromHref('https://example.com/foo')).toBeNull();
    expect(projectBaseFromHref('https://gitlab.com/dashboard')).toBeNull();
  });
});

describe('buildPipelineNewUrl', () => {
  it('returns null when the tab is not a project URL', () => {
    expect(buildPipelineNewUrl('https://example.com/foo', [{ key: 'a', value: '1' }])).toBeNull();
  });

  it('appends /-/pipelines/new and the serialized query', () => {
    expect(
      buildPipelineNewUrl('https://gitlab.com/acme/app/-/merge_requests', [
        { key: '_branch', value: 'main' },
        { key: 'a', value: '1' },
      ]),
    ).toBe('https://gitlab.com/acme/app/-/pipelines/new?_branch=main&a=1');
  });

  it('omits ? when params serialize to empty', () => {
    expect(buildPipelineNewUrl('https://gitlab.com/acme/app/-/pipelines', [])).toBe(
      'https://gitlab.com/acme/app/-/pipelines/new',
    );
  });
});

describe('isValidBulkText', () => {
  it('accepts optional ? and normal pairs', () => {
    expect(isValidBulkText('?_branch=main&a=1')).toBe(true);
    expect(isValidBulkText('_branch=main&a=1')).toBe(true);
  });

  it('accepts empty and ? only', () => {
    expect(isValidBulkText('')).toBe(true);
    expect(isValidBulkText('?')).toBe(true);
    expect(isValidBulkText('   ')).toBe(true);
  });

  it('accepts encoded spaces and trailing &', () => {
    expect(isValidBulkText('a=hello%20world')).toBe(true);
    expect(isValidBulkText('a=hello+world')).toBe(true);
    expect(isValidBulkText('a=1&')).toBe(true);
  });

  it('accepts key-only segments as empty values', () => {
    expect(isValidBulkText('a')).toBe(true);
  });

  it('rejects ASCII whitespace in the trimmed string', () => {
    expect(isValidBulkText('a=hello world')).toBe(false);
  });

  it('rejects empty keys', () => {
    expect(isValidBulkText('&=1')).toBe(false);
    expect(isValidBulkText('?a=1&=2')).toBe(false);
  });

  it('rejects #', () => {
    expect(isValidBulkText('a=1#x')).toBe(false);
  });
});
