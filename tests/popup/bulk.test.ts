import { describe, expect, it } from 'vitest';
import { isValidBulkText, parseQuery, serializeParams } from '../../src/shared/query';

describe('bulk view conversion', () => {
  it('serializes current params when opening Bulk', () => {
    expect(
      serializeParams([
        { key: '_branch', value: 'main' },
        { key: 'a', value: '1' },
        { key: 'b', value: '2' },
        { key: 'c', value: '3' },
      ]),
    ).toBe('?_branch=main&a=1&b=2&c=3');
  });

  it('parses valid bulk back to params and collapses duplicates', () => {
    expect(isValidBulkText('?a=1&b=2&a=3')).toBe(true);
    expect(parseQuery('?a=1&b=2&a=3')).toEqual([
      { key: 'a', value: '3' },
      { key: 'b', value: '2' },
    ]);
  });

  it('rejects invalid bulk so params must stay unchanged', () => {
    expect(isValidBulkText('a=hello world')).toBe(false);
    expect(isValidBulkText('&=1')).toBe(false);
  });
});
