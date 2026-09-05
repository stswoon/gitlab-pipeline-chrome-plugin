import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadStorage, saveStorage } from './storage';

function mockChrome(initial: Record<string, unknown> = {}): Record<string, unknown> {
  const store = { ...initial };
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (keys: string[]) => {
          const out: Record<string, unknown> = {};
          for (const key of keys) {
            if (key in store) {
              out[key] = store[key];
            }
          }
          return out;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(store, items);
        }),
      },
    },
  });
  return store;
}

describe('loadStorage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes defaults on first install', async () => {
    const store = mockChrome();
    await expect(loadStorage()).resolves.toEqual({ profiles: [], selectedProfileId: null });
    expect(store).toEqual({ profiles: [], selectedProfileId: null });
  });

  it('repairs a stale selectedProfileId and writes back', async () => {
    const profiles = [{ id: 'a', name: 'A', params: [] }];
    const store = mockChrome({ profiles, selectedProfileId: 'missing' });
    await expect(loadStorage()).resolves.toEqual({ profiles, selectedProfileId: 'a' });
    expect(store.selectedProfileId).toBe('a');
  });
});

describe('saveStorage', () => {
  it('writes only profiles and selectedProfileId', async () => {
    const store = mockChrome();
    await saveStorage({
      profiles: [{ id: 'a', name: 'A', params: [{ key: 'x', value: '1' }] }],
      selectedProfileId: 'a',
    });
    expect(store).toEqual({
      profiles: [{ id: 'a', name: 'A', params: [{ key: 'x', value: '1' }] }],
      selectedProfileId: 'a',
    });
  });
});
