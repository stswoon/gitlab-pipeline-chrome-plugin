import { describe, expect, it } from 'vitest';
import { displayProfileName, isApplyDisabled } from './ui-state';

describe('displayProfileName', () => {
  it('shows Untitled when the stored name is empty', () => {
    expect(displayProfileName('')).toBe('Untitled');
    expect(displayProfileName('Profile 1')).toBe('Profile 1');
  });
});

describe('isApplyDisabled', () => {
  it('disables Apply when there are zero profiles or bulk is invalid', () => {
    expect(isApplyDisabled(0, false)).toBe(true);
    expect(isApplyDisabled(1, true)).toBe(true);
    expect(isApplyDisabled(1, false)).toBe(false);
  });
});
