import { describe, expect, it } from 'vitest';
import type { Param } from '../shared/query';
import { fillForm } from './fill';
import { isSkippedFillKey } from './fill-rules';

function remainingKeys(params: Param[]): string[] {
  return params
    .filter((param) => param.key !== '_branch' && !isSkippedFillKey(param.key))
    .map((param) => param.key);
}

describe('fillForm', () => {
  it('is exported for the content-script cascade', () => {
    expect(typeof fillForm).toBe('function');
  });

  it('walks remaining keys in parse order and skips reserved keys', () => {
    const params: Param[] = [
      { key: 'email', value: 'a@b.c' },
      { key: '_branch', value: 'main' },
      { key: '_hidden', value: 'no' },
      { key: 'tags', value: 'web,api' },
      { key: '', value: 'skip' },
    ];
    expect(remainingKeys(params)).toEqual(['email', 'tags']);
  });
});
