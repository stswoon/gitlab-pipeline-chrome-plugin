import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('manifest.json', () => {
  it('is MV3 GitLab Pipeline Prefill with storage+activeTab only', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf8')) as {
      manifest_version: number;
      name: string;
      version: string;
      description: string;
      minimum_chrome_version: string;
      permissions: string[];
      background?: unknown;
      options_page?: unknown;
      options_ui?: unknown;
      action: { default_popup: string; default_title: string };
      content_scripts: Array<{ matches: string[]; js: string[]; run_at: string }>;
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('GitLab Pipeline Prefill');
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.description).toBe(
      'Prefill GitLab Run new pipeline from URL query parameters and named profiles.',
    );
    expect(manifest.minimum_chrome_version).toBe('116');
    expect(manifest.permissions).toEqual(['storage', 'activeTab']);
    expect(manifest.background).toBeUndefined();
    expect(manifest.options_page).toBeUndefined();
    expect(manifest.options_ui).toBeUndefined();
    expect(manifest.action.default_title).toBe('GitLab Pipeline Prefill');
    expect(manifest.action.default_popup).toBe('src/popup/index.html');
    expect(manifest.content_scripts).toEqual([
      {
        matches: ['http://*/*', 'https://*/*'],
        js: ['content.js'],
        run_at: 'document_idle',
      },
    ]);
  });
});
