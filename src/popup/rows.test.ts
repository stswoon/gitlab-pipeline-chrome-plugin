import { describe, expect, it } from 'vitest';
import { addEmptyRow, removeRowAt, tryUpdateRowKey, updateRowValue } from '../shared/profiles';

describe('rows editor rules', () => {
  it('Add row appends an empty pair', () => {
    expect(addEmptyRow([])).toEqual([{ key: '', value: '' }]);
  });

  it('rejects a duplicate key and keeps the previous params', () => {
    const params = [
      { key: '_branch', value: 'main' },
      { key: 'a', value: '1' },
    ];
    expect(tryUpdateRowKey(params, 1, '_branch')).toEqual({
      params,
      error: 'Keys must be unique.',
    });
  });

  it('persists a unique key and a value change', () => {
    const withKey = tryUpdateRowKey([{ key: '', value: '' }], 0, 'email');
    expect(withKey.error).toBeNull();
    expect(updateRowValue(withKey.params, 0, 'a@b.c')).toEqual([
      { key: 'email', value: 'a@b.c' },
    ]);
  });

  it('removes a row immediately', () => {
    expect(removeRowAt([{ key: 'a', value: '1' }, { key: 'b', value: '2' }], 0)).toEqual([
      { key: 'b', value: '2' },
    ]);
  });
});
