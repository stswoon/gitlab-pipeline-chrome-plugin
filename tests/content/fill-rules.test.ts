import { describe, expect, it } from 'vitest';
import { isSkippedFillKey, listSelection, parseBooleanQuery } from '../../src/content/fill-rules';

describe('isSkippedFillKey', () => {
  it('skips empty keys and any key starting with _', () => {
    expect(isSkippedFillKey('')).toBe(true);
    expect(isSkippedFillKey('_branch')).toBe(true);
    expect(isSkippedFillKey('_other')).toBe(true);
    expect(isSkippedFillKey('email')).toBe(false);
  });
});

describe('parseBooleanQuery', () => {
  it('accepts true/false case-insensitively after trim', () => {
    expect(parseBooleanQuery('true')).toBe(true);
    expect(parseBooleanQuery(' FALSE ')).toBe(false);
  });

  it('returns null for any other value including empty', () => {
    expect(parseBooleanQuery('')).toBeNull();
    expect(parseBooleanQuery('yes')).toBeNull();
  });
});

describe('listSelection', () => {
  it('returns the case-sensitive intersection in option order', () => {
    expect(listSelection('web,api', ['web', 'api', 'mobile'])).toEqual(['web', 'api']);
    expect(listSelection('web, missing', ['web', 'api'])).toEqual(['web']);
    expect(listSelection('Web', ['web'])).toEqual([]);
    expect(listSelection(',,,', ['web'])).toEqual([]);
  });
});
