import { describe, expect, it, vi } from 'vitest';
import type { Profile } from './query';
import {
  addEmptyRow,
  createProfile,
  deleteProfile,
  nextDefaultName,
  normalizeStorage,
  removeRowAt,
  tryUpdateRowKey,
  updateRowValue,
} from './profiles';

function profile(id: string, name: string): Profile {
  return { id, name, params: [] };
}

describe('nextDefaultName', () => {
  it('uses the smallest missing Profile N', () => {
    expect(nextDefaultName([])).toBe('Profile 1');
    expect(nextDefaultName([profile('a', 'Profile 1'), profile('b', 'Profile 3')])).toBe(
      'Profile 2',
    );
    expect(nextDefaultName([profile('a', 'Profile 1'), profile('b', 'Profile 2')])).toBe(
      'Profile 3',
    );
  });

  it('requires an exact Profile N name', () => {
    expect(nextDefaultName([profile('a', 'profile 1'), profile('b', 'Profile 1 ')])).toBe(
      'Profile 1',
    );
  });
});

describe('normalizeStorage', () => {
  it('defaults missing fields', () => {
    expect(normalizeStorage({})).toEqual({
      value: { profiles: [], selectedProfileId: null },
      didRepair: true,
    });
  });

  it('keeps a valid selection', () => {
    const raw = {
      profiles: [profile('a', 'A')],
      selectedProfileId: 'a',
    };
    expect(normalizeStorage(raw)).toEqual({ value: raw, didRepair: false });
  });

  it('repairs a stale selectedProfileId to the first profile', () => {
    const profiles = [profile('a', 'A'), profile('b', 'B')];
    expect(normalizeStorage({ profiles, selectedProfileId: 'missing' })).toEqual({
      value: { profiles, selectedProfileId: 'a' },
      didRepair: true,
    });
  });

  it('repairs a stale selectedProfileId to null when empty', () => {
    expect(normalizeStorage({ profiles: [], selectedProfileId: 'x' })).toEqual({
      value: { profiles: [], selectedProfileId: null },
      didRepair: true,
    });
  });
});

describe('createProfile', () => {
  it('appends Profile N with a uuid and empty params', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });
    const result = createProfile([profile('a', 'Profile 1')]);
    expect(result.created).toEqual({ id: 'uuid-1', name: 'Profile 2', params: [] });
    expect(result.profiles).toHaveLength(2);
    vi.unstubAllGlobals();
  });
});

describe('deleteProfile', () => {
  it('selects the old next neighbor, then the new last, then null', () => {
    const a = profile('a', 'A');
    const b = profile('b', 'B');
    const c = profile('c', 'C');
    expect(deleteProfile([a, b, c], 'b', 'b')).toEqual({
      profiles: [a, c],
      selectedProfileId: 'c',
    });
    expect(deleteProfile([a, c], 'c', 'c')).toEqual({
      profiles: [a],
      selectedProfileId: 'a',
    });
    expect(deleteProfile([a], 'a', 'a')).toEqual({
      profiles: [],
      selectedProfileId: null,
    });
  });

  it('keeps the current selection when deleting another profile', () => {
    const a = profile('a', 'A');
    const b = profile('b', 'B');
    expect(deleteProfile([a, b], 'a', 'b')).toEqual({
      profiles: [a],
      selectedProfileId: 'a',
    });
  });
});

describe('tryUpdateRowKey', () => {
  it('rejects a duplicate non-empty key', () => {
    const params = [
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ];
    expect(tryUpdateRowKey(params, 1, 'a')).toEqual({
      params,
      error: 'Keys must be unique.',
    });
  });

  it('allows multiple empty keys', () => {
    const params = [
      { key: '', value: '1' },
      { key: '', value: '2' },
    ];
    expect(tryUpdateRowKey(params, 1, '')).toEqual({
      params: [
        { key: '', value: '1' },
        { key: '', value: '2' },
      ],
      error: null,
    });
  });

  it('updates a unique key', () => {
    const params = [{ key: 'a', value: '1' }];
    expect(tryUpdateRowKey(params, 0, 'email')).toEqual({
      params: [{ key: 'email', value: '1' }],
      error: null,
    });
  });
});

describe('row helpers', () => {
  it('adds and removes rows and updates values', () => {
    const added = addEmptyRow([{ key: 'a', value: '1' }]);
    expect(added).toEqual([
      { key: 'a', value: '1' },
      { key: '', value: '' },
    ]);
    expect(removeRowAt(added, 0)).toEqual([{ key: '', value: '' }]);
    expect(updateRowValue(added, 0, 'z')).toEqual([
      { key: 'a', value: 'z' },
      { key: '', value: '' },
    ]);
  });
});
