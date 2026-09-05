import { describe, expect, it } from 'vitest';
import * as wait from './wait';

describe('wait exports', () => {
  it('exposes form-ready helpers', () => {
    expect(typeof wait.isFormReady).toBe('function');
    expect(typeof wait.waitForForm).toBe('function');
    expect(typeof wait.waitForStabilize).toBe('function');
    expect(typeof wait.findBranchToggle).toBe('function');
    expect(typeof wait.findVariablesSection).toBe('function');
  });
});
