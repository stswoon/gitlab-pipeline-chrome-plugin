import { describe, expect, it } from 'vitest';
import { pickOptionLike } from '../../src/content/listbox-pick';

describe('pickOptionLike', () => {
  it('prefers value when value and label would pick different options', () => {
    const items = [
      { value: 'prod', label: 'Production' },
      { value: 'Production', label: 'prod' },
    ];
    expect(pickOptionLike(items, 'prod')).toEqual({ value: 'prod', label: 'Production' });
  });

  it('falls back to exact case-sensitive label', () => {
    expect(pickOptionLike([{ value: 'refs/heads/main', label: 'main' }], 'main')).toEqual({
      value: 'refs/heads/main',
      label: 'main',
    });
  });

  it('returns null when nothing matches', () => {
    expect(pickOptionLike([{ value: 'a', label: 'A' }], 'b')).toBeNull();
  });
});
