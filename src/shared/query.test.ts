import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyBulkInput, displayBulkText, type Profile } from './query.ts';

function profile(overrides: Partial<Profile> = {}): Profile {
  return { id: '1', name: 'P', params: [], ...overrides };
}

test('saves raw textarea text after one character', () => {
  const result = applyBulkInput(profile(), 'e');
  assert.equal(result.profile.bulkText, 'e');
  assert.equal(result.bulkValid, true);
  assert.deepEqual(result.profile.params, [{ key: 'e', value: '' }]);
});

test('saves invalid in-progress text without changing last valid params', () => {
  const existing = profile({
    params: [{ key: 'email', value: 'a' }],
    bulkText: 'email=a',
  });
  const result = applyBulkInput(existing, 'email=a b');
  assert.equal(result.profile.bulkText, 'email=a b');
  assert.equal(result.bulkValid, false);
  assert.deepEqual(result.profile.params, [{ key: 'email', value: 'a' }]);
});

test('displayBulkText prefers stored raw text', () => {
  assert.equal(
    displayBulkText(
      profile({
        bulkText: 'a=1',
        params: [{ key: 'a', value: '1' }],
      }),
    ),
    'a=1',
  );
});

test('displayBulkText falls back to serialize for legacy profiles', () => {
  assert.equal(displayBulkText(profile({ params: [{ key: 'a', value: '1' }] })), '?a=1');
});
