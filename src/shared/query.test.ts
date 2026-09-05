import { describe, expect, it } from 'vitest';
import { parseQuery, serializeParams, splitListValues } from './query';

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
