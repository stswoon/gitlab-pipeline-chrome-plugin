# GitLab Pipeline Prefill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that prefills GitLab’s Run new pipeline form from URL query parameters and named popup profiles, without ever clicking Run pipeline.

**Architecture:** A Vite-built popup persists profiles in `chrome.storage.local` and, on Apply, navigates the active tab to `{projectBase}/-/pipelines/new` plus the profile query. A separately bundled IIFE content script runs only on GitLab `/-/pipelines/new` pages with a non-empty query, waits for the form, then fills branch, Inputs, and Variables through the DOM. Shared TypeScript in `src/shared/` is imported by both bundles; the popup never messages the content script.

**Tech Stack:** Chrome Manifest V3, TypeScript (`strict: true`), Vite (popup + IIFE content-script builds), vanilla HTML/CSS/TS popup, Vitest (Node) for parser/URL/profile helpers, npm.

## Global Constraints

- Extension name (manifest `name`, toolbar tooltip): `GitLab Pipeline Prefill`
- All popup copy is English
- Manifest V3
- TypeScript (`strict: true`)
- Vite for bundling (not Plasmo, not WXT, not webpack-only)
- Popup: vanilla HTML, CSS, and TypeScript compiled to JS. No React, Vue, or other UI framework in the extension
- Content script drives the GitLab page DOM as a user would. No GitLab GraphQL, REST, or other internal APIs for filling
- No background service worker. No background script with business logic. Popup and content script are the only extension pages/scripts
- Shared TypeScript module imported by both popup and content-script bundles
- Unit tests: Vitest, parser/URL helpers only (no live GitLab)
- npm is the package manager. `package.json` `version` is `0.1.0`
- Content-script format is IIFE so `filling` / `done` stay in that file’s closure and nothing leaks onto the page
- `permissions`: `["storage", "activeTab"]` only
- No `background` key
- No `options_page` / `options_ui`
- Icons are a simple generic play/pipeline mark (16/32/48/128 PNG). Do not use GitLab’s tanuki logo
- Minimum Chrome: 116
- Do not request the `tabs` permission
- `host_permissions` are not listed separately; do not request `<all_urls>` beyond the two match patterns `http://*/*` and `https://*/*`
- Keys that start with `_` are reserved. The only reserved key implemented now is `_branch`
- `chrome.storage.local` holds exactly `profiles` and `selectedProfileId`
- Never click **Run pipeline**. Never click **Cancel**. Do not open **Select inputs** / **Preview inputs**
- No toast and no overlay on the GitLab page
- Do not use `sessionStorage`, `localStorage`, or page cookies to record that a fill ran
- Never claim storage is encrypted

---

## Scope check

This is one Chrome extension. Keep a single plan. The repo is greenfield today (README, `.gitignore`, `task/`, and the design spec only). Task 1 creates the toolchain; later tasks add the product.

## File structure

| Path | Responsibility |
|---|---|
| `package.json` | npm package `gitlab-pipeline-prefill` version `0.1.0`; scripts `test`, `icons`, `build` |
| `tsconfig.json` | `strict: true`, ES2022, DOM + `chrome` types, `noEmit` |
| `vite.config.ts` | Vitest config + popup build from `src/popup/index.html`; copies `manifest.json` into `dist/` |
| `vite.content.config.ts` | IIFE content-script build → `dist/content.js` (`emptyOutDir: false`) |
| `manifest.json` | MV3 source manifest (copied to `dist/manifest.json`) |
| `.gitignore` | Ignore `.idea/`, `node_modules/`, `dist/` |
| `scripts/generate-icons.mjs` | Writes indigo play-triangle PNGs to `public/icons/` |
| `public/icons/icon16.png` | Toolbar/extension icon 16 |
| `public/icons/icon32.png` | Toolbar/extension icon 32 |
| `public/icons/icon48.png` | Toolbar/extension icon 48 |
| `public/icons/icon128.png` | Toolbar/extension icon 128 |
| `src/shared/query.ts` | `Param`, `Profile`, `StorageShape`; parse/serialize; list split; project base; pipeline URL; bulk validation |
| `src/shared/query.test.ts` | Spec §10.1 query/URL/bulk tests |
| `src/shared/profiles.ts` | `nextDefaultName`, `normalizeStorage`, create/delete profile, row mutations |
| `src/shared/profiles.test.ts` | Profile helper tests |
| `src/popup/storage.ts` | `loadStorage` / `saveStorage` over `chrome.storage.local` |
| `src/popup/storage.test.ts` | Storage I/O with a mocked `chrome` |
| `src/popup/ui-state.ts` | `displayProfileName`, `isApplyDisabled` |
| `src/popup/ui-state.test.ts` | Popup display/disable rules |
| `src/popup/apply-url.ts` | `decideApplyUrl`, `APPLY_NOT_PROJECT` |
| `src/popup/apply-url.test.ts` | Apply destination vs not-a-project error |
| `src/popup/index.html` | Popup DOM |
| `src/popup/popup.css` | 400px popup styles; error color `#c62828` |
| `src/popup/main.ts` | Profile CRUD, rows/bulk, Apply |
| `src/content/match.ts` | `isRunNewPipelinePage`, `hasQueryParams` |
| `src/content/match.test.ts` | Host/path/query gate tests |
| `src/content/fill-rules.ts` | Skip reserved keys; boolean parse; list intersection |
| `src/content/fill-rules.test.ts` | Fill-rule unit tests |
| `src/content/dom.ts` | Native value setter, `sleep`, `textOf` |
| `src/content/wait.ts` | Form-ready detection, 15s wait, 400ms stabilize |
| `src/content/listbox-pick.ts` | Value-preferred option picker |
| `src/content/listbox.ts` | Open GitLab listbox and click an option |
| `src/content/branch.ts` | `_branch` set + stabilize |
| `src/content/widgets.ts` | Inputs table row lookup and widget apply |
| `src/content/variables.ts` | Variable row find/set/add |
| `src/content/fill.ts` | `_branch` first, then cascade |
| `src/content/index.ts` | IIFE lifecycle (`filling` / `done` closure only) |

Do not add a service worker, options page, React, Plasmo, or WXT.

User-facing copy (use verbatim):

- `GitLab Pipeline Prefill`
- `Prefill GitLab Run new pipeline from URL query parameters and named profiles.`
- `Untitled` (display only, when `name` is `""`)
- `New profile`
- `Delete`
- `Rows`
- `Bulk`
- `Add row`
- `Remove`
- `Apply`
- `Keys must be unique.`
- `Invalid query string.`
- `This tab is not a GitLab project. Open a project page and try Apply again.`
- `[GitLab Pipeline Prefill] Run new pipeline form not ready within 15s`

---

### Task 1: Parse and serialize query params

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Modify: `.gitignore` (entire file)
- Create: `src/shared/query.test.ts`
- Create: `src/shared/query.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `export type Param = { key: string; value: string }`; `export type Profile = { id: string; name: string; params: Param[] }`; `export type StorageShape = { profiles: Profile[]; selectedProfileId: string | null }`; `export function parseQuery(input: string): Param[]`; `export function serializeParams(params: Param[]): string`

- [x] **Step 1: Write the failing test**

Replace `.gitignore` with:

```gitignore
/.idea/
node_modules/
dist/
```

Create `package.json`:

```json
{
  "name": "gitlab-pipeline-prefill",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/chrome": "^0.1.4",
    "typescript": "^5.9.2",
    "vite": "^7.1.5",
    "vitest": "^3.2.4"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["chrome"]
  },
  "include": ["src/**/*.ts", "vite.config.ts", "vite.content.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

Create `src/shared/query.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseQuery, serializeParams } from './query';

describe('parseQuery', () => {
  it('treats a leading ? as optional', () => {
    expect(parseQuery('?a=1')).toEqual(parseQuery('a=1'));
    expect(parseQuery('?a=1')).toEqual([{ key: 'a', value: '1' }]);
  });

  it('preserves left-to-right order', () => {
    expect(parseQuery('_branch=main&a=1&b=2')).toEqual([
      { key: '_branch', value: 'main' },
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
  });

  it('keeps _branch as a normal key', () => {
    expect(parseQuery('?_branch=main&a=1')).toEqual([
      { key: '_branch', value: 'main' },
      { key: 'a', value: '1' },
    ]);
  });

  it('uses last duplicate value and first-seen position', () => {
    expect(parseQuery('a=1&b=2&a=3')).toEqual([
      { key: 'a', value: '3' },
      { key: 'b', value: '2' },
    ]);
  });

  it('keeps empty values', () => {
    expect(parseQuery('a=')).toEqual([{ key: 'a', value: '' }]);
  });

  it('returns [] for empty input, ? only, or whitespace', () => {
    expect(parseQuery('')).toEqual([]);
    expect(parseQuery('?')).toEqual([]);
    expect(parseQuery('   ')).toEqual([]);
  });

  it('decodes + and %XX', () => {
    expect(parseQuery('a=hello+world&b=a%40b.c')).toEqual([
      { key: 'a', value: 'hello world' },
      { key: 'b', value: 'a@b.c' },
    ]);
  });

  it('does not throw on junk', () => {
    expect(() => parseQuery('%%%')).not.toThrow();
    expect(Array.isArray(parseQuery('%%%'))).toBe(true);
  });
});

describe('serializeParams', () => {
  it('emits a leading ? when there is at least one kept pair', () => {
    expect(
      serializeParams([
        { key: '_branch', value: 'main' },
        { key: 'a', value: '1' },
        { key: 'b', value: '2' },
        { key: 'c', value: '3' },
      ]),
    ).toBe('?_branch=main&a=1&b=2&c=3');
  });

  it('skips empty keys after trim and keeps empty values', () => {
    expect(
      serializeParams([
        { key: '', value: 'x' },
        { key: '  ', value: 'y' },
        { key: 'a', value: '' },
      ]),
    ).toBe('?a=');
  });

  it('returns "" when nothing is kept', () => {
    expect(serializeParams([])).toBe('');
    expect(serializeParams([{ key: '', value: 'x' }])).toBe('');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm install` then `npx vitest run src/shared/query.test.ts`

Expected: FAIL with `Failed to resolve import "./query"` (or `Cannot find module './query'`).

- [x] **Step 3: Write minimal implementation**

Create `src/shared/query.ts`:

```ts
export type Param = { key: string; value: string };

export type Profile = {
  id: string;
  name: string;
  params: Param[];
};

export type StorageShape = {
  profiles: Profile[];
  selectedProfileId: string | null;
};

export function parseQuery(input: string): Param[] {
  let source = input.trim();
  if (source.startsWith('?')) {
    source = source.slice(1);
  }
  if (source === '') {
    return [];
  }

  const seenIndex = new Map<string, number>();
  const params: Param[] = [];
  for (const [key, value] of new URLSearchParams(source)) {
    const existing = seenIndex.get(key);
    if (existing === undefined) {
      seenIndex.set(key, params.length);
      params.push({ key, value });
    } else {
      params[existing] = { key, value };
    }
  }
  return params;
}

export function serializeParams(params: Param[]): string {
  const search = new URLSearchParams();
  for (const { key, value } of params) {
    if (key.trim() === '') {
      continue;
    }
    search.append(key, value);
  }
  const encoded = search.toString();
  return encoded === '' ? '' : `?${encoded}`;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/query.test.ts`

Expected: PASS (all tests).

- [x] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .gitignore src/shared/query.ts src/shared/query.test.ts
git commit -m "feat: parse and serialize pipeline query params"
```

---

### Task 2: Split list query values

**Files:**
- Modify: `src/shared/query.ts` (append exports)
- Modify: `src/shared/query.test.ts` (append describe)

**Interfaces:**
- Consumes: nothing new
- Produces: `export function splitListValues(raw: string): string[]`

- [x] **Step 1: Write the failing test**

Append to `src/shared/query.test.ts` (keep existing imports and describes; add `splitListValues` to the import):

```ts
import { describe, expect, it } from 'vitest';
import { parseQuery, serializeParams, splitListValues } from './query';

describe('parseQuery', () => {
  it('treats a leading ? as optional', () => {
    expect(parseQuery('?a=1')).toEqual(parseQuery('a=1'));
    expect(parseQuery('?a=1')).toEqual([{ key: 'a', value: '1' }]);
  });

  it('preserves left-to-right order', () => {
    expect(parseQuery('_branch=main&a=1&b=2')).toEqual([
      { key: '_branch', value: 'main' },
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
  });

  it('keeps _branch as a normal key', () => {
    expect(parseQuery('?_branch=main&a=1')).toEqual([
      { key: '_branch', value: 'main' },
      { key: 'a', value: '1' },
    ]);
  });

  it('uses last duplicate value and first-seen position', () => {
    expect(parseQuery('a=1&b=2&a=3')).toEqual([
      { key: 'a', value: '3' },
      { key: 'b', value: '2' },
    ]);
  });

  it('keeps empty values', () => {
    expect(parseQuery('a=')).toEqual([{ key: 'a', value: '' }]);
  });

  it('returns [] for empty input, ? only, or whitespace', () => {
    expect(parseQuery('')).toEqual([]);
    expect(parseQuery('?')).toEqual([]);
    expect(parseQuery('   ')).toEqual([]);
  });

  it('decodes + and %XX', () => {
    expect(parseQuery('a=hello+world&b=a%40b.c')).toEqual([
      { key: 'a', value: 'hello world' },
      { key: 'b', value: 'a@b.c' },
    ]);
  });

  it('does not throw on junk', () => {
    expect(() => parseQuery('%%%')).not.toThrow();
    expect(Array.isArray(parseQuery('%%%'))).toBe(true);
  });
});

describe('serializeParams', () => {
  it('emits a leading ? when there is at least one kept pair', () => {
    expect(
      serializeParams([
        { key: '_branch', value: 'main' },
        { key: 'a', value: '1' },
        { key: 'b', value: '2' },
        { key: 'c', value: '3' },
      ]),
    ).toBe('?_branch=main&a=1&b=2&c=3');
  });

  it('skips empty keys after trim and keeps empty values', () => {
    expect(
      serializeParams([
        { key: '', value: 'x' },
        { key: '  ', value: 'y' },
        { key: 'a', value: '' },
      ]),
    ).toBe('?a=');
  });

  it('returns "" when nothing is kept', () => {
    expect(serializeParams([])).toBe('');
    expect(serializeParams([{ key: '', value: 'x' }])).toBe('');
  });
});

describe('splitListValues', () => {
  it('splits on commas', () => {
    expect(splitListValues('web,api')).toEqual(['web', 'api']);
  });

  it('trims tokens', () => {
    expect(splitListValues('web, api')).toEqual(['web', 'api']);
  });

  it('keeps a single token', () => {
    expect(splitListValues('web')).toEqual(['web']);
  });

  it('returns [] for empty or only commas', () => {
    expect(splitListValues('')).toEqual([]);
    expect(splitListValues(',,,')).toEqual([]);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/query.test.ts`

Expected: FAIL with `splitListValues is not exported` / `does not provide an export named 'splitListValues'`.

- [x] **Step 3: Write minimal implementation**

Append to `src/shared/query.ts` (do not change existing functions):

```ts
export function splitListValues(raw: string): string[] {
  return raw
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token !== '');
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/query.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/shared/query.ts src/shared/query.test.ts
git commit -m "feat: split comma-separated list query values"
```

---

### Task 3: Project base URL and pipeline URL

**Files:**
- Modify: `src/shared/query.ts` (append exports)
- Modify: `src/shared/query.test.ts` (append describe; keep `splitListValues` import and add the two new names)

**Interfaces:**
- Consumes: `serializeParams(params: Param[]): string`
- Produces: `export function projectBaseFromHref(tabHref: string): string | null`; `export function buildPipelineNewUrl(tabHref: string, params: Param[]): string | null`

- [x] **Step 1: Write the failing test**

Add these imports and describes to `src/shared/query.test.ts` (keep all Task 1–2 tests unchanged):

```ts
import { buildPipelineNewUrl, parseQuery, projectBaseFromHref, serializeParams, splitListValues } from './query';
```

```ts
describe('projectBaseFromHref', () => {
  it('slices a normal project URL at the first /-/ ', () => {
    expect(projectBaseFromHref('https://gitlab.com/acme/app/-/pipelines')).toBe(
      'https://gitlab.com/acme/app',
    );
  });

  it('keeps nested groups', () => {
    expect(projectBaseFromHref('https://gitlab.com/group/sub/proj/-/pipelines/new')).toBe(
      'https://gitlab.com/group/sub/proj',
    );
    expect(projectBaseFromHref('https://gitlab.com/a/b/c/-/pipelines/new')).toBe(
      'https://gitlab.com/a/b/c',
    );
  });

  it('keeps scheme host and port', () => {
    expect(projectBaseFromHref('https://gitlab.example.com:8443/g/p/-/jobs/1')).toBe(
      'https://gitlab.example.com:8443/g/p',
    );
  });

  it('ignores query and hash when finding /-/ ', () => {
    expect(projectBaseFromHref('https://gitlab.com/acme/app/-/pipelines/new?x=1#y')).toBe(
      'https://gitlab.com/acme/app',
    );
  });

  it('returns null when /-/ is missing', () => {
    expect(projectBaseFromHref('https://example.com/foo')).toBeNull();
    expect(projectBaseFromHref('https://gitlab.com/dashboard')).toBeNull();
  });
});

describe('buildPipelineNewUrl', () => {
  it('returns null when the tab is not a project URL', () => {
    expect(buildPipelineNewUrl('https://example.com/foo', [{ key: 'a', value: '1' }])).toBeNull();
  });

  it('appends /-/pipelines/new and the serialized query', () => {
    expect(
      buildPipelineNewUrl('https://gitlab.com/acme/app/-/merge_requests', [
        { key: '_branch', value: 'main' },
        { key: 'a', value: '1' },
      ]),
    ).toBe('https://gitlab.com/acme/app/-/pipelines/new?_branch=main&a=1');
  });

  it('omits ? when params serialize to empty', () => {
    expect(buildPipelineNewUrl('https://gitlab.com/acme/app/-/pipelines', [])).toBe(
      'https://gitlab.com/acme/app/-/pipelines/new',
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/query.test.ts`

Expected: FAIL with `projectBaseFromHref is not exported` / `does not provide an export named 'projectBaseFromHref'`.

- [x] **Step 3: Write minimal implementation**

Append to `src/shared/query.ts`:

```ts
export function projectBaseFromHref(tabHref: string): string | null {
  let href = tabHref;
  const hashAt = href.indexOf('#');
  if (hashAt !== -1) {
    href = href.slice(0, hashAt);
  }
  const queryAt = href.indexOf('?');
  if (queryAt !== -1) {
    href = href.slice(0, queryAt);
  }
  const markerAt = href.indexOf('/-/');
  if (markerAt === -1) {
    return null;
  }
  return href.slice(0, markerAt);
}

export function buildPipelineNewUrl(tabHref: string, params: Param[]): string | null {
  const base = projectBaseFromHref(tabHref);
  if (base === null) {
    return null;
  }
  return `${base}/-/pipelines/new${serializeParams(params)}`;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/query.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/shared/query.ts src/shared/query.test.ts
git commit -m "feat: derive GitLab project base and pipeline URL"
```

---

### Task 4: Validate bulk query text

**Files:**
- Modify: `src/shared/query.ts` (append export)
- Modify: `src/shared/query.test.ts` (append describe)

**Interfaces:**
- Consumes: nothing new
- Produces: `export function isValidBulkText(raw: string): boolean`

- [x] **Step 1: Write the failing test**

Add `isValidBulkText` to the import in `src/shared/query.test.ts` and append:

```ts
describe('isValidBulkText', () => {
  it('accepts optional ? and normal pairs', () => {
    expect(isValidBulkText('?_branch=main&a=1')).toBe(true);
    expect(isValidBulkText('_branch=main&a=1')).toBe(true);
  });

  it('accepts empty and ? only', () => {
    expect(isValidBulkText('')).toBe(true);
    expect(isValidBulkText('?')).toBe(true);
    expect(isValidBulkText('   ')).toBe(true);
  });

  it('accepts encoded spaces and trailing &', () => {
    expect(isValidBulkText('a=hello%20world')).toBe(true);
    expect(isValidBulkText('a=hello+world')).toBe(true);
    expect(isValidBulkText('a=1&')).toBe(true);
  });

  it('accepts key-only segments as empty values', () => {
    expect(isValidBulkText('a')).toBe(true);
  });

  it('rejects ASCII whitespace in the trimmed string', () => {
    expect(isValidBulkText('a=hello world')).toBe(false);
  });

  it('rejects empty keys', () => {
    expect(isValidBulkText('&=1')).toBe(false);
    expect(isValidBulkText('?a=1&=2')).toBe(false);
  });

  it('rejects #', () => {
    expect(isValidBulkText('a=1#x')).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/query.test.ts`

Expected: FAIL with `does not provide an export named 'isValidBulkText'`.

- [x] **Step 3: Write minimal implementation**

Append to `src/shared/query.ts`:

```ts
export function isValidBulkText(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '?') {
    return true;
  }
  if (trimmed.includes('#')) {
    return false;
  }
  if (/[ \t\n\r]/.test(trimmed)) {
    return false;
  }
  const body = trimmed.startsWith('?') ? trimmed.slice(1) : trimmed;
  for (const segment of body.split('&')) {
    if (segment === '') {
      continue;
    }
    if (segment.startsWith('=')) {
      return false;
    }
  }
  return true;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/query.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/shared/query.ts src/shared/query.test.ts
git commit -m "feat: validate popup bulk query text"
```

---

### Task 5: Profile and storage helpers

**Files:**
- Create: `src/shared/profiles.ts`
- Create: `src/shared/profiles.test.ts`

**Interfaces:**
- Consumes: `Profile`, `StorageShape`, `Param` from `src/shared/query.ts`
- Produces: `export function nextDefaultName(profiles: ReadonlyArray<Pick<Profile, "name">>): string`; `export function normalizeStorage(raw: unknown): { value: StorageShape; didRepair: boolean }`; `export function createProfile(profiles: Profile[]): { profiles: Profile[]; created: Profile }`; `export function deleteProfile(profiles: Profile[], selectedProfileId: string | null, deleteId: string): { profiles: Profile[]; selectedProfileId: string | null }`; `export function tryUpdateRowKey(params: Param[], index: number, nextKey: string): { params: Param[]; error: string | null }`; `export function addEmptyRow(params: Param[]): Param[]`; `export function removeRowAt(params: Param[], index: number): Param[]`; `export function updateRowValue(params: Param[], index: number, value: string): Param[]`

- [x] **Step 1: Write the failing test**

Create `src/shared/profiles.test.ts`:

```ts
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/profiles.test.ts`

Expected: FAIL with `Failed to resolve import "./profiles"`.

- [x] **Step 3: Write minimal implementation**

Create `src/shared/profiles.ts`:

```ts
import type { Param, Profile, StorageShape } from './query';

function isParam(value: unknown): value is Param {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as Param;
  return typeof row.key === 'string' && typeof row.value === 'string';
}

function isProfile(value: unknown): value is Profile {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const profile = value as Profile;
  return (
    typeof profile.id === 'string' &&
    typeof profile.name === 'string' &&
    Array.isArray(profile.params) &&
    profile.params.every(isParam)
  );
}

export function nextDefaultName(profiles: ReadonlyArray<Pick<Profile, 'name'>>): string {
  const names = new Set(profiles.map((profile) => profile.name));
  let n = 1;
  while (names.has(`Profile ${n}`)) {
    n += 1;
  }
  return `Profile ${n}`;
}

export function normalizeStorage(raw: unknown): { value: StorageShape; didRepair: boolean } {
  const obj = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const incoming = Array.isArray(obj.profiles) ? obj.profiles : [];
  const profiles = incoming.filter(isProfile);
  let didRepair = !Array.isArray(obj.profiles) || profiles.length !== incoming.length;

  let selectedProfileId: string | null = null;
  if (obj.selectedProfileId === null || obj.selectedProfileId === undefined) {
    selectedProfileId = null;
  } else if (typeof obj.selectedProfileId === 'string') {
    selectedProfileId = obj.selectedProfileId;
  } else {
    selectedProfileId = null;
    didRepair = true;
  }

  if (selectedProfileId !== null && !profiles.some((profile) => profile.id === selectedProfileId)) {
    selectedProfileId = profiles[0]?.id ?? null;
    didRepair = true;
  }

  return { value: { profiles, selectedProfileId }, didRepair };
}

export function createProfile(profiles: Profile[]): { profiles: Profile[]; created: Profile } {
  const created: Profile = {
    id: crypto.randomUUID(),
    name: nextDefaultName(profiles),
    params: [],
  };
  return { profiles: [...profiles, created], created };
}

export function deleteProfile(
  profiles: Profile[],
  selectedProfileId: string | null,
  deleteId: string,
): { profiles: Profile[]; selectedProfileId: string | null } {
  const index = profiles.findIndex((profile) => profile.id === deleteId);
  if (index === -1) {
    return { profiles, selectedProfileId };
  }
  const next = profiles.filter((profile) => profile.id !== deleteId);
  if (selectedProfileId !== deleteId && next.some((profile) => profile.id === selectedProfileId)) {
    return { profiles: next, selectedProfileId };
  }
  const selected = next[index] ?? next[next.length - 1] ?? null;
  return { profiles: next, selectedProfileId: selected?.id ?? null };
}

export function tryUpdateRowKey(
  params: Param[],
  index: number,
  nextKey: string,
): { params: Param[]; error: string | null } {
  if (nextKey !== '' && params.some((param, i) => i !== index && param.key === nextKey)) {
    return { params, error: 'Keys must be unique.' };
  }
  return {
    params: params.map((param, i) => (i === index ? { ...param, key: nextKey } : param)),
    error: null,
  };
}

export function addEmptyRow(params: Param[]): Param[] {
  return [...params, { key: '', value: '' }];
}

export function removeRowAt(params: Param[], index: number): Param[] {
  return params.filter((_, i) => i !== index);
}

export function updateRowValue(params: Param[], index: number, value: string): Param[] {
  return params.map((param, i) => (i === index ? { ...param, value } : param));
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/profiles.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/shared/profiles.ts src/shared/profiles.test.ts
git commit -m "feat: add profile storage and row helpers"
```

---

### Task 6: Manifest, icons, and Vite extension build

**Files:**
- Create: `manifest.json`
- Create: `scripts/generate-icons.mjs`
- Create: `vite.content.config.ts`
- Create: `src/content/index.ts`
- Create: `src/popup/index.html`
- Create: `src/popup/popup.css`
- Create: `src/popup/main.ts`
- Create: `src/shared/manifest.test.ts`
- Modify: `package.json` (scripts)
- Modify: `vite.config.ts` (entire file)

**Interfaces:**
- Consumes: nothing
- Produces: loadable unpacked `dist/` with `manifest.json`, `content.js`, popup HTML, and icons; no `background` key

- [x] **Step 1: Write the failing test**

Create `src/shared/manifest.test.ts`:

```ts
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/manifest.test.ts`

Expected: FAIL with `ENOENT` for `manifest.json`.

- [x] **Step 3: Write minimal implementation**

Create `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "GitLab Pipeline Prefill",
  "version": "0.1.0",
  "description": "Prefill GitLab Run new pipeline from URL query parameters and named profiles.",
  "minimum_chrome_version": "116",
  "permissions": ["storage", "activeTab"],
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "src/popup/index.html",
    "default_title": "GitLab Pipeline Prefill",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

Create `scripts/generate-icons.mjs` (indigo play mark, not the GitLab tanuki):

```js
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcSrc = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcSrc));
  return Buffer.concat([length, crcSrc, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    rgba[i * 4] = 0x3f;
    rgba[i * 4 + 1] = 0x51;
    rgba[i * 4 + 2] = 0xb5;
    rgba[i * 4 + 3] = 0xff;
  }
  const left = Math.round(size * 0.32);
  const right = Math.round(size * 0.72);
  const top = Math.round(size * 0.22);
  const bottom = Math.round(size * 0.78);
  for (let y = top; y <= bottom; y += 1) {
    const t = (y - top) / Math.max(bottom - top, 1);
    const half = (1 - Math.abs(2 * t - 1)) * (right - left);
    for (let x = left; x <= left + half; x += 1) {
      const i = (y * size + x) * 4;
      rgba[i] = 0xff;
      rgba[i + 1] = 0xff;
      rgba[i + 2] = 0xff;
      rgba[i + 3] = 0xff;
    }
  }
  return encodePng(size, size, rgba);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(dir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(dir, `icon${size}.png`), drawIcon(size));
}
```

Replace `vite.config.ts` with:

```ts
import { copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: 'public',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(root, 'src/popup/index.html'),
      },
    },
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        copyFileSync(resolve(root, 'manifest.json'), resolve(root, 'dist/manifest.json'));
      },
    },
  ],
});
```

Create `vite.content.config.ts`:

```ts
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    rollupOptions: {
      input: resolve(root, 'src/content/index.ts'),
      output: {
        format: 'iife',
        name: 'unusedGitLabPipelinePrefill',
        extend: true,
        entryFileNames: 'content.js',
        inlineDynamicImports: true,
      },
    },
  },
});
```

Create `src/content/index.ts` (no-op IIFE; no observers, no DOM writes, no exports):

```ts
(function gitlabPipelinePrefill(): void {})();
```

Create `src/popup/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GitLab Pipeline Prefill</title>
    <link rel="stylesheet" href="./popup.css" />
  </head>
  <body>
    <div id="app" class="is-empty">
      <div id="profile-switcher-wrap">
        <label for="profile-select">Profile</label>
        <select id="profile-select"></select>
      </div>
      <div id="name-wrap">
        <label for="profile-name">Name</label>
        <input id="profile-name" type="text" />
      </div>
      <div class="toolbar">
        <button id="btn-new-profile" type="button">New profile</button>
        <button id="btn-delete" type="button" disabled>Delete</button>
      </div>
      <div id="view-toggle-wrap">
        <div id="view-toggle">
          <button id="btn-view-rows" type="button" aria-pressed="true">Rows</button>
          <button id="btn-view-bulk" type="button" aria-pressed="false">Bulk</button>
        </div>
      </div>
      <div id="rows-view">
        <div id="rows-list"></div>
        <button id="btn-add-row" type="button">Add row</button>
      </div>
      <div id="bulk-view" hidden>
        <textarea id="bulk-text" spellcheck="false"></textarea>
      </div>
      <div id="error-line"></div>
      <button id="btn-apply" type="button" disabled>Apply</button>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

Create `src/popup/popup.css`:

```css
html,
body {
  margin: 0;
  width: 400px;
  font: 13px/1.4 system-ui, sans-serif;
  color: #1f1f1f;
}

#app {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.is-empty #profile-switcher-wrap,
.is-empty #name-wrap,
.is-empty #btn-delete,
.is-empty #view-toggle-wrap,
.is-empty #rows-view,
.is-empty #bulk-view {
  display: none;
}

label {
  display: block;
  font-weight: 600;
  margin-bottom: 4px;
}

input[type='text'],
select,
textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 6px 8px;
}

textarea {
  min-height: 120px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.toolbar,
#view-toggle {
  display: flex;
  gap: 8px;
  align-items: center;
}

#view-toggle button[aria-pressed='true'] {
  font-weight: 700;
}

.kv-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 6px;
  margin-bottom: 6px;
}

#error-line {
  min-height: 1.2em;
  color: #c62828;
}

#btn-apply {
  font-weight: 700;
}

button:disabled {
  opacity: 0.5;
}
```

Create `src/popup/main.ts`:

```ts
document.getElementById('btn-apply');
```

Replace the `scripts` object in `package.json` with:

```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "icons": "node scripts/generate-icons.mjs",
    "build": "npm run icons && vite build && vite build --config vite.content.config.ts"
  },
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/manifest.test.ts`

Expected: PASS.

Then run: `npm run build`

Expected: exit 0. `dist/manifest.json`, `dist/content.js`, `dist/src/popup/index.html`, `dist/icons/icon16.png` (and 32/48/128) exist. `dist/manifest.json` has no `background` key.

Manual load (also used after later tasks): Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `d:\mycode\gitlab-pipeline-chrome-plugin\dist`. Toolbar tooltip must read `GitLab Pipeline Prefill`.

- [x] **Step 5: Commit**

```bash
git add manifest.json scripts/generate-icons.mjs vite.config.ts vite.content.config.ts package.json src/content/index.ts src/popup/index.html src/popup/popup.css src/popup/main.ts src/shared/manifest.test.ts public/icons
git commit -m "chore: add MV3 manifest, icons, and Vite extension build"
```

---

### Task 7: Popup storage load and zero-profile shell

**Files:**
- Create: `src/popup/storage.ts`
- Create: `src/popup/storage.test.ts`
- Modify: `src/popup/main.ts` (entire file)

**Interfaces:**
- Consumes: `normalizeStorage(raw: unknown): { value: StorageShape; didRepair: boolean }`; `StorageShape`
- Produces: `export async function loadStorage(): Promise<StorageShape>`; `export async function saveStorage(data: StorageShape): Promise<void>`

- [x] **Step 1: Write the failing test**

Create `src/popup/storage.test.ts`:

```ts
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/popup/storage.test.ts`

Expected: FAIL with `Failed to resolve import "./storage"`.

- [x] **Step 3: Write minimal implementation**

Create `src/popup/storage.ts`:

```ts
import { normalizeStorage } from '../shared/profiles';
import type { StorageShape } from '../shared/query';

export async function saveStorage(data: StorageShape): Promise<void> {
  await chrome.storage.local.set({
    profiles: data.profiles,
    selectedProfileId: data.selectedProfileId,
  });
}

export async function loadStorage(): Promise<StorageShape> {
  const raw = await chrome.storage.local.get(['profiles', 'selectedProfileId']);
  const { value, didRepair } = normalizeStorage(raw);
  if (didRepair || raw.profiles === undefined) {
    await saveStorage(value);
  }
  return value;
}
```

Replace `src/popup/main.ts` with:

```ts
import { loadStorage } from './storage';

async function init(): Promise<void> {
  const state = await loadStorage();
  const app = document.getElementById('app');
  const apply = document.getElementById('btn-apply');
  if (!(app instanceof HTMLElement) || !(apply instanceof HTMLButtonElement)) {
    return;
  }
  const empty = state.profiles.length === 0;
  app.classList.toggle('is-empty', empty);
  apply.disabled = empty;
}

void init();
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/popup/storage.test.ts`

Expected: PASS.

Then `npm run build` (exit 0). Reload the unpacked `dist/` extension. Open the popup: only **New profile** and a disabled **Apply** are visible. No error text. No switcher, name, Delete, Rows/Bulk.

- [x] **Step 5: Commit**

```bash
git add src/popup/storage.ts src/popup/storage.test.ts src/popup/main.ts
git commit -m "feat: load popup profiles from chrome.storage.local"
```

---

### Task 8: Profile create, switch, rename, and delete

**Files:**
- Create: `src/popup/ui-state.ts`
- Create: `src/popup/ui-state.test.ts`
- Modify: `src/popup/main.ts` (entire file)

**Interfaces:**
- Consumes: `createProfile`, `deleteProfile`, `loadStorage`, `saveStorage`, `StorageShape`, `Profile`
- Produces: `export function displayProfileName(name: string): string`; `export function isApplyDisabled(profileCount: number, bulkInvalid: boolean): boolean`; popup event handlers that persist `profiles` and `selectedProfileId`

- [x] **Step 1: Write the failing test**

Create `src/popup/ui-state.test.ts`:

```ts
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/popup/ui-state.test.ts`

Expected: FAIL with `Failed to resolve import "./ui-state"`.

- [x] **Step 3: Write minimal implementation**

Create `src/popup/ui-state.ts`:

```ts
export function displayProfileName(name: string): string {
  return name === '' ? 'Untitled' : name;
}

export function isApplyDisabled(profileCount: number, bulkInvalid: boolean): boolean {
  return profileCount === 0 || bulkInvalid;
}
```

Replace `src/popup/main.ts` with:

```ts
import { createProfile, deleteProfile } from '../shared/profiles';
import type { Profile, StorageShape } from '../shared/query';
import { loadStorage, saveStorage } from './storage';
import { displayProfileName, isApplyDisabled } from './ui-state';

const APPLY_NOT_PROJECT =
  'This tab is not a GitLab project. Open a project page and try Apply again.';

let state: StorageShape = { profiles: [], selectedProfileId: null };
let errorText = '';

function selectedProfile(): Profile | null {
  return state.profiles.find((profile) => profile.id === state.selectedProfileId) ?? null;
}

function errorEl(): HTMLElement {
  return document.getElementById('error-line') as HTMLElement;
}

function setError(text: string): void {
  errorText = text;
  errorEl().textContent = text;
}

function clearApplyError(): void {
  if (errorText === APPLY_NOT_PROJECT) {
    setError('');
  }
}

async function persist(): Promise<void> {
  await saveStorage(state);
}

function render(): void {
  const app = document.getElementById('app') as HTMLElement;
  const apply = document.getElementById('btn-apply') as HTMLButtonElement;
  const del = document.getElementById('btn-delete') as HTMLButtonElement;
  const select = document.getElementById('profile-select') as HTMLSelectElement;
  const name = document.getElementById('profile-name') as HTMLInputElement;
  const empty = state.profiles.length === 0;
  app.classList.toggle('is-empty', empty);
  apply.disabled = isApplyDisabled(state.profiles.length, false);
  del.disabled = selectedProfile() === null;
  select.innerHTML = '';
  for (const profile of state.profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = displayProfileName(profile.name);
    select.appendChild(option);
  }
  if (state.selectedProfileId) {
    select.value = state.selectedProfileId;
  }
  name.value = selectedProfile()?.name ?? '';
}

async function init(): Promise<void> {
  state = await loadStorage();
  render();

  document.getElementById('btn-new-profile')?.addEventListener('click', async () => {
    const result = createProfile(state.profiles);
    state = { profiles: result.profiles, selectedProfileId: result.created.id };
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('btn-delete')?.addEventListener('click', async () => {
    if (!state.selectedProfileId) {
      return;
    }
    const result = deleteProfile(state.profiles, state.selectedProfileId, state.selectedProfileId);
    state = result;
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('profile-select')?.addEventListener('change', async (event) => {
    state.selectedProfileId = (event.target as HTMLSelectElement).value;
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('profile-name')?.addEventListener('input', async (event) => {
    const profile = selectedProfile();
    if (!profile) {
      return;
    }
    profile.name = (event.target as HTMLInputElement).value;
    clearApplyError();
    await persist();
    const select = document.getElementById('profile-select') as HTMLSelectElement;
    const option = Array.from(select.options).find((item) => item.value === profile.id);
    if (option) {
      option.textContent = displayProfileName(profile.name);
    }
  });
}

void init();
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/popup/ui-state.test.ts src/popup/storage.test.ts src/shared/profiles.test.ts`

Expected: PASS.

Then `npm run build`, reload `dist/` in Chrome, open the popup:

1. Click **New profile** → switcher shows `Profile 1`, name field is `Profile 1`, **Delete** and **Apply** enable, Rows view is visible.
2. Click **New profile** again → `Profile 2` is selected.
3. Clear the name field → switcher shows `Untitled`; storage still stores `""`.
4. Click **Delete** with no confirm dialog → selection moves to the neighbor; last delete returns to the zero-profile shell.

- [x] **Step 5: Commit**

```bash
git add src/popup/main.ts src/popup/ui-state.ts src/popup/ui-state.test.ts
git commit -m "feat: add popup profile create, switch, rename, and delete"
```

---

### Task 9: Rows editor

**Files:**
- Modify: `src/popup/main.ts` (entire file)

**Interfaces:**
- Consumes: `addEmptyRow(params: Param[]): Param[]`; `removeRowAt(params: Param[], index: number): Param[]`; `tryUpdateRowKey(params: Param[], index: number, nextKey: string): { params: Param[]; error: string | null }`; `updateRowValue(params: Param[], index: number, value: string): Param[]`
- Produces: rows UI that persists `profile.params` on each successful edit

- [x] **Step 1: Write the failing test**

Create `src/popup/rows.test.ts`:

```ts
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/popup/rows.test.ts`

Expected: PASS against the existing helpers. If FAIL, fix `src/shared/profiles.ts` first. The implementation step is the popup wiring.

- [x] **Step 3: Write minimal implementation**

Replace `src/popup/main.ts` with:

```ts
import { addEmptyRow, createProfile, deleteProfile, removeRowAt, tryUpdateRowKey, updateRowValue } from '../shared/profiles';
import type { Profile, StorageShape } from '../shared/query';
import { loadStorage, saveStorage } from './storage';
import { displayProfileName, isApplyDisabled } from './ui-state';

const APPLY_NOT_PROJECT =
  'This tab is not a GitLab project. Open a project page and try Apply again.';
const DUPLICATE_KEY = 'Keys must be unique.';

let state: StorageShape = { profiles: [], selectedProfileId: null };
let errorText = '';

function selectedProfile(): Profile | null {
  return state.profiles.find((profile) => profile.id === state.selectedProfileId) ?? null;
}

function errorEl(): HTMLElement {
  return document.getElementById('error-line') as HTMLElement;
}

function setError(text: string): void {
  errorText = text;
  errorEl().textContent = text;
}

function clearApplyError(): void {
  if (errorText === APPLY_NOT_PROJECT) {
    setError('');
  }
}

async function persist(): Promise<void> {
  await saveStorage(state);
}

function renderRows(): void {
  const list = document.getElementById('rows-list') as HTMLElement;
  list.replaceChildren();
  const profile = selectedProfile();
  if (!profile) {
    return;
  }
  profile.params.forEach((param, index) => {
    const row = document.createElement('div');
    row.className = 'kv-row';

    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.value = param.key;
    keyInput.setAttribute('aria-label', 'Key');
    keyInput.addEventListener('input', async () => {
      const result = tryUpdateRowKey(profile.params, index, keyInput.value);
      if (result.error) {
        keyInput.value = profile.params[index]!.key;
        setError(result.error);
        return;
      }
      profile.params = result.params;
      if (errorText === DUPLICATE_KEY) {
        setError('');
      }
      clearApplyError();
      await persist();
    });

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.value = param.value;
    valueInput.setAttribute('aria-label', 'Value');
    valueInput.addEventListener('input', async () => {
      profile.params = updateRowValue(profile.params, index, valueInput.value);
      clearApplyError();
      await persist();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      profile.params = removeRowAt(profile.params, index);
      clearApplyError();
      await persist();
      render();
    });

    row.append(keyInput, valueInput, remove);
    list.appendChild(row);
  });
}

function render(): void {
  const app = document.getElementById('app') as HTMLElement;
  const apply = document.getElementById('btn-apply') as HTMLButtonElement;
  const del = document.getElementById('btn-delete') as HTMLButtonElement;
  const select = document.getElementById('profile-select') as HTMLSelectElement;
  const name = document.getElementById('profile-name') as HTMLInputElement;
  const empty = state.profiles.length === 0;
  app.classList.toggle('is-empty', empty);
  apply.disabled = isApplyDisabled(state.profiles.length, false);
  del.disabled = selectedProfile() === null;
  select.innerHTML = '';
  for (const profile of state.profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = displayProfileName(profile.name);
    select.appendChild(option);
  }
  if (state.selectedProfileId) {
    select.value = state.selectedProfileId;
  }
  name.value = selectedProfile()?.name ?? '';
  renderRows();
}

async function init(): Promise<void> {
  state = await loadStorage();
  render();

  document.getElementById('btn-new-profile')?.addEventListener('click', async () => {
    const result = createProfile(state.profiles);
    state = { profiles: result.profiles, selectedProfileId: result.created.id };
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('btn-delete')?.addEventListener('click', async () => {
    if (!state.selectedProfileId) {
      return;
    }
    const result = deleteProfile(state.profiles, state.selectedProfileId, state.selectedProfileId);
    state = result;
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('profile-select')?.addEventListener('change', async (event) => {
    state.selectedProfileId = (event.target as HTMLSelectElement).value;
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('profile-name')?.addEventListener('input', async (event) => {
    const profile = selectedProfile();
    if (!profile) {
      return;
    }
    profile.name = (event.target as HTMLInputElement).value;
    clearApplyError();
    await persist();
    const select = document.getElementById('profile-select') as HTMLSelectElement;
    const option = Array.from(select.options).find((item) => item.value === profile.id);
    if (option) {
      option.textContent = displayProfileName(profile.name);
    }
  });

  document.getElementById('btn-add-row')?.addEventListener('click', async () => {
    const profile = selectedProfile();
    if (!profile) {
      return;
    }
    profile.params = addEmptyRow(profile.params);
    clearApplyError();
    await persist();
    render();
  });
}

void init();
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/popup/rows.test.ts`

Expected: PASS.

Then `npm run build`, reload `dist/`, open the popup, create a profile:

1. **Add row** appends empty key/value fields. `_branch` is a normal key.
2. Type `a` in two keys → second key reverts; error line is `Keys must be unique.`
3. Change a unique key/value → reopen the popup (it starts on Rows) and the row is still there.
4. **Remove** deletes the row immediately.

- [x] **Step 5: Commit**

```bash
git add src/popup/main.ts src/popup/rows.test.ts
git commit -m "feat: add popup rows editor for profile params"
```

---

### Task 10: Bulk query editor

**Files:**
- Modify: `src/popup/main.ts` (entire file)

**Interfaces:**
- Consumes: `isValidBulkText(raw: string): boolean`; `parseQuery(input: string): Param[]`; `serializeParams(params: Param[]): string`
- Produces: in-memory view mode `'rows' | 'bulk'` (always starts as `'rows'`); bulk `input` writes `params` only when valid

- [x] **Step 1: Write the failing test**

Create `src/popup/bulk.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isValidBulkText, parseQuery, serializeParams } from '../shared/query';

describe('bulk view conversion', () => {
  it('serializes current params when opening Bulk', () => {
    expect(
      serializeParams([
        { key: '_branch', value: 'main' },
        { key: 'a', value: '1' },
        { key: 'b', value: '2' },
        { key: 'c', value: '3' },
      ]),
    ).toBe('?_branch=main&a=1&b=2&c=3');
  });

  it('parses valid bulk back to params and collapses duplicates', () => {
    expect(isValidBulkText('?a=1&b=2&a=3')).toBe(true);
    expect(parseQuery('?a=1&b=2&a=3')).toEqual([
      { key: 'a', value: '3' },
      { key: 'b', value: '2' },
    ]);
  });

  it('rejects invalid bulk so params must stay unchanged', () => {
    expect(isValidBulkText('a=hello world')).toBe(false);
    expect(isValidBulkText('&=1')).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/popup/bulk.test.ts`

Expected: PASS against `src/shared/query.ts`. If FAIL, fix query helpers first.

- [x] **Step 3: Write minimal implementation**

Replace `src/popup/main.ts` with:

```ts
import {
  addEmptyRow,
  createProfile,
  deleteProfile,
  removeRowAt,
  tryUpdateRowKey,
  updateRowValue,
} from '../shared/profiles';
import {
  isValidBulkText,
  parseQuery,
  serializeParams,
  type Profile,
  type StorageShape,
} from '../shared/query';
import { loadStorage, saveStorage } from './storage';
import { displayProfileName, isApplyDisabled } from './ui-state';

const APPLY_NOT_PROJECT =
  'This tab is not a GitLab project. Open a project page and try Apply again.';
const DUPLICATE_KEY = 'Keys must be unique.';
const INVALID_BULK = 'Invalid query string.';

type ViewMode = 'rows' | 'bulk';

let state: StorageShape = { profiles: [], selectedProfileId: null };
let view: ViewMode = 'rows';
let bulkValid = true;
let errorText = '';

function selectedProfile(): Profile | null {
  return state.profiles.find((profile) => profile.id === state.selectedProfileId) ?? null;
}

function errorEl(): HTMLElement {
  return document.getElementById('error-line') as HTMLElement;
}

function setError(text: string): void {
  errorText = text;
  errorEl().textContent = text;
}

function clearApplyError(): void {
  if (errorText === APPLY_NOT_PROJECT) {
    setError('');
  }
}

async function persist(): Promise<void> {
  await saveStorage(state);
}

function syncBulkTextarea(): void {
  const textarea = document.getElementById('bulk-text') as HTMLTextAreaElement;
  const profile = selectedProfile();
  textarea.value = profile ? serializeParams(profile.params) : '';
}

function renderRows(): void {
  const list = document.getElementById('rows-list') as HTMLElement;
  list.replaceChildren();
  const profile = selectedProfile();
  if (!profile) {
    return;
  }
  profile.params.forEach((param, index) => {
    const row = document.createElement('div');
    row.className = 'kv-row';

    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.value = param.key;
    keyInput.setAttribute('aria-label', 'Key');
    keyInput.addEventListener('input', async () => {
      const result = tryUpdateRowKey(profile.params, index, keyInput.value);
      if (result.error) {
        keyInput.value = profile.params[index]!.key;
        setError(result.error);
        return;
      }
      profile.params = result.params;
      if (errorText === DUPLICATE_KEY) {
        setError('');
      }
      clearApplyError();
      await persist();
    });

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.value = param.value;
    valueInput.setAttribute('aria-label', 'Value');
    valueInput.addEventListener('input', async () => {
      profile.params = updateRowValue(profile.params, index, valueInput.value);
      clearApplyError();
      await persist();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      profile.params = removeRowAt(profile.params, index);
      clearApplyError();
      await persist();
      render();
    });

    row.append(keyInput, valueInput, remove);
    list.appendChild(row);
  });
}

function render(): void {
  const app = document.getElementById('app') as HTMLElement;
  const apply = document.getElementById('btn-apply') as HTMLButtonElement;
  const del = document.getElementById('btn-delete') as HTMLButtonElement;
  const select = document.getElementById('profile-select') as HTMLSelectElement;
  const name = document.getElementById('profile-name') as HTMLInputElement;
  const rowsView = document.getElementById('rows-view') as HTMLElement;
  const bulkView = document.getElementById('bulk-view') as HTMLElement;
  const empty = state.profiles.length === 0;
  app.classList.toggle('is-empty', empty);
  apply.disabled = isApplyDisabled(state.profiles.length, view === 'bulk' && !bulkValid);
  del.disabled = selectedProfile() === null;
  select.innerHTML = '';
  for (const profile of state.profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = displayProfileName(profile.name);
    select.appendChild(option);
  }
  if (state.selectedProfileId) {
    select.value = state.selectedProfileId;
  }
  name.value = selectedProfile()?.name ?? '';
  rowsView.hidden = view !== 'rows';
  bulkView.hidden = view !== 'bulk';
  document.getElementById('btn-view-rows')?.setAttribute('aria-pressed', String(view === 'rows'));
  document.getElementById('btn-view-bulk')?.setAttribute('aria-pressed', String(view === 'bulk'));
  renderRows();
}

async function init(): Promise<void> {
  state = await loadStorage();
  view = 'rows';
  bulkValid = true;
  render();

  document.getElementById('btn-new-profile')?.addEventListener('click', async () => {
    const result = createProfile(state.profiles);
    state = { profiles: result.profiles, selectedProfileId: result.created.id };
    view = 'rows';
    bulkValid = true;
    if (errorText === INVALID_BULK) {
      setError('');
    }
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('btn-delete')?.addEventListener('click', async () => {
    if (!state.selectedProfileId) {
      return;
    }
    const result = deleteProfile(state.profiles, state.selectedProfileId, state.selectedProfileId);
    state = result;
    view = 'rows';
    bulkValid = true;
    if (errorText === INVALID_BULK) {
      setError('');
    }
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('profile-select')?.addEventListener('change', async (event) => {
    state.selectedProfileId = (event.target as HTMLSelectElement).value;
    bulkValid = true;
    if (errorText === INVALID_BULK) {
      setError('');
    }
    clearApplyError();
    await persist();
    render();
    if (view === 'bulk') {
      syncBulkTextarea();
    }
  });

  document.getElementById('profile-name')?.addEventListener('input', async (event) => {
    const profile = selectedProfile();
    if (!profile) {
      return;
    }
    profile.name = (event.target as HTMLInputElement).value;
    clearApplyError();
    await persist();
    const select = document.getElementById('profile-select') as HTMLSelectElement;
    const option = Array.from(select.options).find((item) => item.value === profile.id);
    if (option) {
      option.textContent = displayProfileName(profile.name);
    }
  });

  document.getElementById('btn-add-row')?.addEventListener('click', async () => {
    const profile = selectedProfile();
    if (!profile) {
      return;
    }
    profile.params = addEmptyRow(profile.params);
    clearApplyError();
    await persist();
    render();
  });

  document.getElementById('btn-view-rows')?.addEventListener('click', () => {
    if (view === 'bulk' && !bulkValid) {
      return;
    }
    view = 'rows';
    render();
  });

  document.getElementById('btn-view-bulk')?.addEventListener('click', () => {
    view = 'bulk';
    render();
    syncBulkTextarea();
  });

  document.getElementById('bulk-text')?.addEventListener('input', async (event) => {
    const raw = (event.target as HTMLTextAreaElement).value;
    const profile = selectedProfile();
    if (!profile) {
      return;
    }
    if (!isValidBulkText(raw)) {
      bulkValid = false;
      setError(INVALID_BULK);
      (document.getElementById('btn-apply') as HTMLButtonElement).disabled = true;
      return;
    }
    bulkValid = true;
    profile.params = parseQuery(raw);
    if (errorText === INVALID_BULK) {
      setError('');
    }
    clearApplyError();
    await persist();
    (document.getElementById('btn-apply') as HTMLButtonElement).disabled = isApplyDisabled(
      state.profiles.length,
      false,
    );
  });
}

void init();
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/popup/bulk.test.ts src/shared/query.test.ts`

Expected: PASS.

Then `npm run build`, reload `dist/`, open the popup on a profile with rows `_branch=main`, `a=1`:

1. Reopen the popup: it starts on **Rows**, not Bulk.
2. Click **Bulk**: textarea is `?_branch=main&a=1`.
3. Type `a=hello world` → error `Invalid query string.`, **Apply** disabled, **Rows** does not switch, storage `params` unchanged.
4. Fix the text to `_branch=main&a=1&b=2` → error clears, **Apply** enables, reopen popup and Rows shows the new keys.
5. Make bulk invalid, switch to another profile: invalid text is discarded; the other profile’s serialized params load.

- [x] **Step 5: Commit**

```bash
git add src/popup/main.ts src/popup/bulk.test.ts
git commit -m "feat: add popup bulk query editor"
```

---

### Task 11: Apply navigates the active tab

**Files:**
- Create: `src/popup/apply-url.ts`
- Create: `src/popup/apply-url.test.ts`
- Modify: `src/popup/main.ts` (import `decideApplyUrl` / `APPLY_NOT_PROJECT`; add Apply click handler)

**Interfaces:**
- Consumes: `buildPipelineNewUrl(tabHref: string, params: Param[]): string | null`; `chrome.tabs.query({ active: true, currentWindow: true })`; `chrome.tabs.update(tabId, { url })`
- Produces: `export const APPLY_NOT_PROJECT: string`; `export function decideApplyUrl(tabUrl: string | undefined, params: Param[]): { url: string } | { error: string }`

- [x] **Step 1: Write the failing test**

Create `src/popup/apply-url.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { APPLY_NOT_PROJECT, decideApplyUrl } from './apply-url';

describe('decideApplyUrl', () => {
  it('builds a pipeline-new URL from a project tab', () => {
    expect(
      decideApplyUrl('https://gitlab.com/group/proj/-/merge_requests', [
        { key: '_branch', value: 'main' },
        { key: 'email', value: 'a@b.c' },
      ]),
    ).toEqual({
      url: 'https://gitlab.com/group/proj/-/pipelines/new?_branch=main&email=a%40b.c',
    });
  });

  it('returns the not-a-project error when the tab has no /-/ or no url', () => {
    expect(APPLY_NOT_PROJECT).toBe(
      'This tab is not a GitLab project. Open a project page and try Apply again.',
    );
    expect(decideApplyUrl(undefined, [{ key: 'a', value: '1' }])).toEqual({
      error: APPLY_NOT_PROJECT,
    });
    expect(decideApplyUrl('https://example.com', [{ key: 'a', value: '1' }])).toEqual({
      error: APPLY_NOT_PROJECT,
    });
    expect(decideApplyUrl('https://gitlab.com/dashboard', [{ key: 'a', value: '1' }])).toEqual({
      error: APPLY_NOT_PROJECT,
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/popup/apply-url.test.ts`

Expected: FAIL with `Failed to resolve import "./apply-url"`.

- [x] **Step 3: Write minimal implementation**

Create `src/popup/apply-url.ts`:

```ts
import { buildPipelineNewUrl, type Param } from '../shared/query';

export const APPLY_NOT_PROJECT =
  'This tab is not a GitLab project. Open a project page and try Apply again.';

export function decideApplyUrl(
  tabUrl: string | undefined,
  params: Param[],
): { url: string } | { error: string } {
  if (!tabUrl) {
    return { error: APPLY_NOT_PROJECT };
  }
  const url = buildPipelineNewUrl(tabUrl, params);
  if (url === null) {
    return { error: APPLY_NOT_PROJECT };
  }
  return { url };
}
```

In `src/popup/main.ts`, delete the local `APPLY_NOT_PROJECT` constant. Add this import:

```ts
import { APPLY_NOT_PROJECT, decideApplyUrl } from './apply-url';
```

Append this listener at the end of `init()`, immediately before `void init();`:

```ts
  document.getElementById('btn-apply')?.addEventListener('click', async () => {
    const profile = selectedProfile();
    if (!profile) {
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setError(APPLY_NOT_PROJECT);
      return;
    }
    const decided = decideApplyUrl(tab.url, profile.params);
    if ('error' in decided) {
      setError(decided.error);
      return;
    }
    setError('');
    await chrome.tabs.update(tab.id, { url: decided.url });
  });
```

`clearApplyError` already clears `APPLY_NOT_PROJECT` when the user edits profiles.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/popup/apply-url.test.ts src/shared/query.test.ts`

Expected: PASS.

Then `npm run build`, reload `dist/`:

1. On `https://gitlab.com/group/proj/-/merge_requests` (any real project page with `/-/`), Apply navigates to `…/-/pipelines/new?…` with the profile query. Hostname does not need to contain `gitlab` for Apply; only `/-/` matters.
2. On `https://example.com` and `https://gitlab.com/dashboard`, Apply shows `This tab is not a GitLab project. Open a project page and try Apply again.` in `#c62828` and the tab URL does not change.
3. Editing a row or the name clears that Apply error.
4. **Apply** stays disabled when there are zero profiles or Bulk text is invalid.

- [x] **Step 5: Commit**

```bash
git add src/popup/main.ts src/popup/apply-url.ts src/popup/apply-url.test.ts
git commit -m "feat: apply profile query to the active GitLab tab"
```

---

### Task 12: Content-script page match and fill rules

**Files:**
- Create: `src/content/match.ts`
- Create: `src/content/match.test.ts`
- Create: `src/content/fill-rules.ts`
- Create: `src/content/fill-rules.test.ts`

**Interfaces:**
- Consumes: `splitListValues(raw: string): string[]`
- Produces: `export type LocationLike = { protocol: string; hostname: string; pathname: string; search: string }`; `export function isRunNewPipelinePage(loc: LocationLike): boolean`; `export function hasQueryParams(search: string): boolean`; `export function isSkippedFillKey(key: string): boolean`; `export function parseBooleanQuery(value: string): boolean | null`; `export function listSelection(raw: string, existingOptions: string[]): string[]`

- [x] **Step 1: Write the failing test**

Create `src/content/match.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hasQueryParams, isRunNewPipelinePage } from './match';

describe('isRunNewPipelinePage', () => {
  it('matches http(s) hosts that contain gitlab, case-insensitively', () => {
    expect(
      isRunNewPipelinePage({
        protocol: 'https:',
        hostname: 'gitlab.com',
        pathname: '/acme/app/-/pipelines/new',
        search: '',
      }),
    ).toBe(true);
    expect(
      isRunNewPipelinePage({
        protocol: 'http:',
        hostname: 'GitLab.example.com',
        pathname: '/g/p/-/pipelines/new/',
        search: '',
      }),
    ).toBe(true);
  });

  it('rejects non-gitlab hosts, wrong protocol, and longer suffixes', () => {
    expect(
      isRunNewPipelinePage({
        protocol: 'https:',
        hostname: 'example.com',
        pathname: '/foo/-/pipelines/new',
        search: '',
      }),
    ).toBe(false);
    expect(
      isRunNewPipelinePage({
        protocol: 'file:',
        hostname: 'gitlab.com',
        pathname: '/acme/app/-/pipelines/new',
        search: '',
      }),
    ).toBe(false);
    expect(
      isRunNewPipelinePage({
        protocol: 'https:',
        hostname: 'gitlab.com',
        pathname: '/acme/app/-/pipelines/new/foo',
        search: '',
      }),
    ).toBe(false);
    expect(
      isRunNewPipelinePage({
        protocol: 'https:',
        hostname: 'gitlab.com',
        pathname: '/acme/app/-/pipelines',
        search: '',
      }),
    ).toBe(false);
  });
});

describe('hasQueryParams', () => {
  it('is false for empty search', () => {
    expect(hasQueryParams('')).toBe(false);
    expect(hasQueryParams('?')).toBe(false);
  });

  it('is true when URLSearchParams has entries', () => {
    expect(hasQueryParams('?_branch=main')).toBe(true);
    expect(hasQueryParams('a=1')).toBe(true);
  });
});
```

Create `src/content/fill-rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isSkippedFillKey, listSelection, parseBooleanQuery } from './fill-rules';

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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/match.test.ts src/content/fill-rules.test.ts`

Expected: FAIL with `Failed to resolve import "./match"` (or `./fill-rules`).

- [x] **Step 3: Write minimal implementation**

Create `src/content/match.ts`:

```ts
export type LocationLike = {
  protocol: string;
  hostname: string;
  pathname: string;
  search: string;
};

export function isRunNewPipelinePage(loc: LocationLike): boolean {
  if (loc.protocol !== 'http:' && loc.protocol !== 'https:') {
    return false;
  }
  if (!loc.hostname.toLowerCase().includes('gitlab')) {
    return false;
  }
  return /\/-\/pipelines\/new\/?$/.test(loc.pathname);
}

export function hasQueryParams(search: string): boolean {
  if (search === '' || search === '?') {
    return false;
  }
  return new URLSearchParams(search).size > 0;
}
```

Create `src/content/fill-rules.ts`:

```ts
import { splitListValues } from '../shared/query';

export function isSkippedFillKey(key: string): boolean {
  return key === '' || key.startsWith('_');
}

export function parseBooleanQuery(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return null;
}

export function listSelection(raw: string, existingOptions: string[]): string[] {
  const tokens = splitListValues(raw);
  return existingOptions.filter((option) => tokens.includes(option));
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/content/match.test.ts src/content/fill-rules.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/content/match.ts src/content/match.test.ts src/content/fill-rules.ts src/content/fill-rules.test.ts
git commit -m "feat: detect GitLab run-new-pipeline pages and fill rules"
```

---

### Task 13: Content-script lifecycle and form wait

**Files:**
- Create: `src/content/dom.ts`
- Create: `src/content/wait.ts`
- Modify: `src/content/index.ts` (entire file)

**Interfaces:**
- Consumes: `isRunNewPipelinePage(loc: LocationLike): boolean`; `hasQueryParams(search: string): boolean`; `parseQuery(input: string): Param[]`
- Produces: `export function textOf(el: Element | null): string`; `export function sleep(ms: number): Promise<void>`; `export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void`; `export function findPipelineFormRegion(doc: Document): HTMLElement | null`; `export function findBranchToggle(doc: Document): HTMLElement | null`; `export function findVariablesSection(doc: Document): HTMLElement | null`; `export function isInputsHeadingPresent(doc: Document): boolean`; `export function isInputsSectionSettled(doc: Document): boolean`; `export function isFormReady(doc: Document): boolean`; `export function waitForForm(doc: Document, timeoutMs?: number): Promise<boolean>`; `export function isSpinnerVisible(region: Element): boolean`; `export function waitForStabilize(formRegion: Element, timeoutMs?: number, quietMs?: number): Promise<void>`; IIFE with closure booleans `filling` and `done`

- [x] **Step 1: Write the failing test**

There is no jsdom/live GitLab unit suite for wait (spec: parser/URL helpers only). Lock the public wait signatures with a compile-and-import smoke test:

Create `src/content/wait.export.test.ts`:

```ts
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/wait.export.test.ts`

Expected: FAIL with `Failed to resolve import "./wait"`.

- [x] **Step 3: Write minimal implementation**

Create `src/content/dom.ts`:

```ts
export function textOf(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
```

Create `src/content/wait.ts`:

```ts
import { textOf } from './dom';

export function findPipelineFormRegion(doc: Document): HTMLElement | null {
  const heading = Array.from(doc.querySelectorAll('h1')).find((el) => textOf(el) === 'Run new pipeline');
  if (heading) {
    const form = heading.closest('form');
    if (form instanceof HTMLElement) {
      return form;
    }
    const main = heading.closest('main, .content-wrapper, [role="main"]');
    if (main instanceof HTMLElement) {
      return main;
    }
  }
  return null;
}

function region(doc: Document): HTMLElement {
  return findPipelineFormRegion(doc) ?? doc.body;
}

export function findBranchToggle(doc: Document): HTMLElement | null {
  for (const label of Array.from(region(doc).querySelectorAll('label'))) {
    if (textOf(label) === 'Run for branch name or tag') {
      const group = label.closest('.gl-form-group, .form-group, fieldset') ?? label.parentElement;
      const button = group?.querySelector('button');
      if (button instanceof HTMLElement) {
        return button;
      }
    }
  }
  return null;
}

export function findVariablesSection(doc: Document): HTMLElement | null {
  const root = region(doc);
  const row = root.querySelector('[data-testid="ci-variable-row-container"]');
  if (row instanceof HTMLElement) {
    return row;
  }
  const key = root.querySelector('[data-testid="pipeline-form-ci-variable-key-field"]');
  if (key instanceof HTMLElement) {
    return key;
  }
  return null;
}

export function isInputsHeadingPresent(doc: Document): boolean {
  return Array.from(
    region(doc).querySelectorAll('h2, h3, h4, .gl-heading, [class*="crud-title"], legend'),
  ).some((el) => textOf(el) === 'Inputs' || textOf(el).startsWith('Inputs'));
}

export function isInputsSectionSettled(doc: Document): boolean {
  const root = region(doc);
  if (root.querySelector('[data-testid="input-row"]')) {
    return true;
  }
  if (root.querySelector('[data-testid="empty-selection-state"]')) {
    return true;
  }
  if (root.querySelector('[data-testid="no-inputs-empty-state"]')) {
    return true;
  }
  if (root.querySelector('table')) {
    return true;
  }
  return Array.from(root.querySelectorAll('p, div')).some((el) => /there are no inputs/i.test(textOf(el)));
}

export function isFormReady(doc: Document): boolean {
  if (!findBranchToggle(doc)) {
    return false;
  }
  if (!findVariablesSection(doc)) {
    return false;
  }
  if (isInputsHeadingPresent(doc) && !isInputsSectionSettled(doc)) {
    return false;
  }
  return true;
}

export function waitForForm(doc: Document, timeoutMs = 15_000): Promise<boolean> {
  if (isFormReady(doc)) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let observer: MutationObserver;
    const timer = window.setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, timeoutMs);
    observer = new MutationObserver(() => {
      if (isFormReady(doc)) {
        window.clearTimeout(timer);
        observer.disconnect();
        resolve(true);
      }
    });
    observer.observe(doc.body, { childList: true, subtree: true });
  });
}

export function isSpinnerVisible(regionEl: Element): boolean {
  const nodes = regionEl.querySelectorAll(
    '.gl-spinner, .gl-loading-icon, [class*="skeleton"], [aria-busy="true"]',
  );
  return Array.from(nodes).some((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

export function waitForStabilize(
  formRegion: Element,
  timeoutMs = 15_000,
  quietMs = 400,
): Promise<void> {
  return new Promise((resolve) => {
    let quietTimer = 0;
    const finish = (): void => {
      window.clearTimeout(deadline);
      window.clearTimeout(quietTimer);
      observer.disconnect();
      resolve();
    };
    const armQuiet = (): void => {
      window.clearTimeout(quietTimer);
      quietTimer = window.setTimeout(() => {
        if (!isSpinnerVisible(formRegion)) {
          finish();
        } else {
          armQuiet();
        }
      }, quietMs);
    };
    const deadline = window.setTimeout(finish, timeoutMs);
    const observer = new MutationObserver(() => {
      armQuiet();
    });
    observer.observe(formRegion, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    if (!isSpinnerVisible(formRegion)) {
      armQuiet();
    }
  });
}
```

Replace `src/content/index.ts` with:

```ts
import { parseQuery } from '../shared/query';
import { hasQueryParams, isRunNewPipelinePage } from './match';
import { waitForForm } from './wait';

(function gitlabPipelinePrefill(): void {
  let filling = false;
  let done = false;

  if (!isRunNewPipelinePage(window.location)) {
    return;
  }
  if (!hasQueryParams(window.location.search)) {
    return;
  }
  if (filling || done) {
    return;
  }

  filling = true;

  void (async () => {
    try {
      const ready = await waitForForm(document, 15_000);
      if (!ready) {
        console.warn('[GitLab Pipeline Prefill] Run new pipeline form not ready within 15s');
        return;
      }
      const params = parseQuery(window.location.search);
      if (params.length === 0) {
        return;
      }
      void params;
    } finally {
      done = true;
      filling = false;
    }
  })();
})();
```

Do not attach a page-level observer that re-enters this IIFE. Do not write `sessionStorage` / `localStorage` / cookies. `filling` and `done` live only in this closure. After this task `fillForm` is not wired yet; a matching page with a query will wait for the form, then exit. Task 15 calls `fillForm`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/content/wait.export.test.ts src/content/match.test.ts`

Expected: PASS.

Then `npm run build`. Confirm `dist/content.js` is a single IIFE file (no `import` statements). Reload `dist/` in Chrome.

Manual:

1. Open `https://example.com` → content script injects but returns immediately (no observers in DevTools Performance/Elements beyond the early return).
2. Open a GitLab `/-/pipelines/new` URL **without** query → no wait, no warn, page unchanged.
3. Open `/-/pipelines/new?_branch=main` on a host whose form never appears (or throttle CPU and use a 15s wait): one `console.warn` line `[GitLab Pipeline Prefill] Run new pipeline form not ready within 15s`. No toast, overlay, or banner.

- [x] **Step 5: Commit**

```bash
git add src/content/dom.ts src/content/wait.ts src/content/index.ts src/content/wait.export.test.ts
git commit -m "feat: wait for the run-new-pipeline form"
```

---

### Task 14: Set branch from `_branch`

**Files:**
- Create: `src/content/listbox-pick.ts`
- Create: `src/content/listbox-pick.test.ts`
- Create: `src/content/listbox.ts`
- Create: `src/content/branch.ts`
- Modify: `src/content/index.ts` (call `setBranchIfNeeded` after wait)

**Interfaces:**
- Consumes: `findBranchToggle(doc: Document): HTMLElement | null`; `waitForStabilize(formRegion: Element, timeoutMs?: number, quietMs?: number): Promise<void>`; `findPipelineFormRegion(doc: Document): HTMLElement | null`; `setNativeValue`; `sleep`; `textOf`
- Produces: `export type OptionLike = { value: string; label: string }`; `export function pickOptionLike(items: OptionLike[], wanted: string): OptionLike | null`; `export function collectListboxItems(doc: Document): HTMLElement[]`; `export function optionValue(el: HTMLElement): string`; `export function pickOption(items: HTMLElement[], wanted: string): HTMLElement | null`; `export async function selectListboxOption(toggle: HTMLElement, wanted: string, search: boolean): Promise<boolean>`; `export async function setBranchIfNeeded(doc: Document, wanted: string): Promise<boolean>` (`true` only when the control was changed)

- [x] **Step 1: Write the failing test**

Create only `src/content/listbox-pick.test.ts` (do not create `listbox-pick.ts` yet):

```ts
import { describe, expect, it } from 'vitest';
import { pickOptionLike } from './listbox-pick';

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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/listbox-pick.test.ts`

Expected: FAIL with `Failed to resolve import "./listbox-pick"`.

- [x] **Step 3: Write minimal implementation**

Create `src/content/listbox-pick.ts`:

```ts
export type OptionLike = { value: string; label: string };

export function pickOptionLike(items: OptionLike[], wanted: string): OptionLike | null {
  const byValue = items.find((item) => item.value === wanted);
  const byLabel = items.find((item) => item.label === wanted);
  if (byValue) {
    return byValue;
  }
  return byLabel ?? null;
}
```

Create `src/content/listbox.ts`:

```ts
import { setNativeValue, sleep, textOf } from './dom';
import { pickOptionLike } from './listbox-pick';

export function optionValue(el: HTMLElement): string {
  const testid = el.getAttribute('data-testid') ?? '';
  const match = /^listbox-item-(.*)$/.exec(testid);
  if (match) {
    return match[1] ?? '';
  }
  return el.getAttribute('data-value') ?? '';
}

export function collectListboxItems(doc: Document): HTMLElement[] {
  return Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[role="option"], li.gl-new-dropdown-item, [data-testid^="listbox-item-"]',
    ),
  ).filter((el) => {
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    return !style || style.display !== 'none';
  });
}

export function pickOption(items: HTMLElement[], wanted: string): HTMLElement | null {
  const mapped = items.map((el) => ({ el, value: optionValue(el), label: textOf(el) }));
  const picked = pickOptionLike(
    mapped.map((item) => ({ value: item.value, label: item.label })),
    wanted,
  );
  if (!picked) {
    return null;
  }
  return mapped.find((item) => item.value === picked.value && item.label === picked.label)?.el ?? null;
}

export async function selectListboxOption(
  toggle: HTMLElement,
  wanted: string,
  search: boolean,
): Promise<boolean> {
  const doc = toggle.ownerDocument;
  toggle.click();
  await sleep(50);
  if (search) {
    const searchInput = doc.querySelector<HTMLInputElement>(
      '.gl-new-dropdown input, [data-testid="listbox-search-input"], input[placeholder="Search refs"]',
    );
    if (searchInput) {
      setNativeValue(searchInput, wanted);
      await sleep(400);
    }
  }
  const match = pickOption(collectListboxItems(doc), wanted);
  if (!match) {
    toggle.click();
    await sleep(50);
    return false;
  }
  match.click();
  await sleep(50);
  return true;
}
```

Create `src/content/branch.ts`:

```ts
import { textOf } from './dom';
import { selectListboxOption } from './listbox';
import { findBranchToggle, findPipelineFormRegion, waitForStabilize } from './wait';

function branchAlreadyMatches(toggle: HTMLElement, wanted: string): boolean {
  if (textOf(toggle) === wanted) {
    return true;
  }
  const value = toggle.getAttribute('data-value') ?? '';
  return value === wanted;
}

export async function setBranchIfNeeded(doc: Document, wanted: string): Promise<boolean> {
  const toggle = findBranchToggle(doc);
  if (!toggle) {
    return false;
  }
  if (branchAlreadyMatches(toggle, wanted)) {
    return false;
  }
  const changed = await selectListboxOption(toggle, wanted, true);
  if (!changed) {
    return false;
  }
  const formRegion = findPipelineFormRegion(doc);
  if (formRegion) {
    await waitForStabilize(formRegion, 15_000, 400);
  }
  return true;
}
```

Replace the `void params;` block in `src/content/index.ts` with a branch-only fill (Inputs/Variables come in Task 15). Full `src/content/index.ts`:

```ts
import { parseQuery } from '../shared/query';
import { setBranchIfNeeded } from './branch';
import { hasQueryParams, isRunNewPipelinePage } from './match';
import { waitForForm } from './wait';

(function gitlabPipelinePrefill(): void {
  let filling = false;
  let done = false;

  if (!isRunNewPipelinePage(window.location)) {
    return;
  }
  if (!hasQueryParams(window.location.search)) {
    return;
  }
  if (filling || done) {
    return;
  }

  filling = true;

  void (async () => {
    try {
      const ready = await waitForForm(document, 15_000);
      if (!ready) {
        console.warn('[GitLab Pipeline Prefill] Run new pipeline form not ready within 15s');
        return;
      }
      const params = parseQuery(window.location.search);
      if (params.length === 0) {
        return;
      }
      const branch = params.find((param) => param.key === '_branch');
      if (branch) {
        await setBranchIfNeeded(document, branch.value);
      }
    } finally {
      done = true;
      filling = false;
    }
  })();
})();
```

Branch rules to implement exactly:

1. If the toggle already displays a ref whose text or value equals `_branch` (exact, case-sensitive), do not open the control and do not wait for stabilize (`setBranchIfNeeded` returns `false`).
2. Otherwise open the GitLab ref listbox (label **Run for branch name or tag**), type the wanted ref into Search refs if that field exists, and click the option whose text or value equals the query (value preferred when both match different options).
3. If no option exists, leave the current branch unchanged; do not wait for stabilize.
4. If the branch changed, wait until the pipeline form region (not the sidebar) has no spinner and no mutations for 400ms, deadline 15_000ms from the start of that wait. On stabilize timeout, continue (do not log a second timeout line).

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/content/listbox-pick.test.ts`

Expected: PASS.

Then `npm run build`, reload `dist/`. On a real project `/-/pipelines/new?_branch=main`:

1. If the dropdown already shows `main`, it must not open.
2. If it shows another ref that exists in the list, it opens, selects `main`, then Inputs/Variables finish loading (stabilize).
3. `?_branch=this-ref-does-not-exist` leaves the current branch unchanged.
4. Refresh (F5) runs the fill again (new JS context; flags start false).

- [x] **Step 5: Commit**

```bash
git add src/content/listbox-pick.ts src/content/listbox-pick.test.ts src/content/listbox.ts src/content/branch.ts src/content/index.ts
git commit -m "feat: set Run for branch name or tag from _branch"
```

---

### Task 15: Fill Inputs and Variables from the query

**Files:**
- Create: `src/content/widgets.ts`
- Create: `src/content/variables.ts`
- Create: `src/content/fill.ts`
- Modify: `src/content/index.ts` (entire file; call `fillForm`)

**Interfaces:**
- Consumes: `Param[]` from `parseQuery`; `isSkippedFillKey(key: string): boolean`; `parseBooleanQuery(value: string): boolean | null`; `listSelection(raw: string, existingOptions: string[]): string[]`; `setBranchIfNeeded(doc: Document, wanted: string): Promise<boolean>`; `setNativeValue`; `sleep`; `textOf`; `selectListboxOption`; `collectListboxItems`; `optionValue`; `pickOption`
- Produces: `export function findInputRow(doc: Document, name: string): HTMLElement | null`; `export async function applyInputWidget(row: HTMLElement, raw: string): Promise<boolean>`; `export function findVariableRow(doc: Document, key: string): HTMLElement | null`; `export function isFileVariableRow(row: HTMLElement): boolean`; `export async function setVariableRow(row: HTMLElement, key: string, value: string): Promise<boolean>`; `export async function addVariable(doc: Document, key: string, value: string): Promise<void>`; `export async function fillForm(doc: Document, params: Param[]): Promise<void>`

GitLab DOM (current gitlab.com Run new pipeline; use these selectors, then fall back to labels):

- Branch: label `Run for branch name or tag` → nearest `button` (GlCollapsibleListbox / RefSelector)
- Inputs rows: `[data-testid="input-row"]` cells Name / Description / Type / Value. Type text is lowercase (`string`, `number`, `boolean`, `array`). Required asterisk: `[data-testid="required-asterisk"]`
- Inputs empty: `[data-testid="empty-selection-state"]` or `[data-testid="no-inputs-empty-state"]`
- Do not click buttons whose text is `Select inputs` or `Preview inputs`
- Variables rows: `[data-testid="ci-variable-row-container"]`
- Variable type toggle: `[data-testid="pipeline-form-ci-variable-type"]` (`Variable` or `File`)
- Variable key: `[data-testid="pipeline-form-ci-variable-key-field"]`
- Variable value: `[data-testid="pipeline-form-ci-variable-value-field"]` or `[data-testid="pipeline-form-ci-variable-value-dropdown"]`
- Submit control (never click): `[data-testid="run-pipeline-button"]` / text `New pipeline` / `Run pipeline`

- [x] **Step 1: Write the failing test**

Create `src/content/fill.test.ts`:

```ts
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/fill.test.ts`

Expected: FAIL with `Failed to resolve import "./fill"`.

- [x] **Step 3: Write minimal implementation**

Create `src/content/widgets.ts`:

```ts
import { setNativeValue, sleep, textOf } from './dom';
import { listSelection, parseBooleanQuery } from './fill-rules';
import { collectListboxItems, optionValue, selectListboxOption } from './listbox';

export function findInputRow(doc: Document, name: string): HTMLElement | null {
  for (const row of Array.from(doc.querySelectorAll<HTMLElement>('[data-testid="input-row"]'))) {
    const nameCell = row.querySelector('td');
    if (!nameCell) {
      continue;
    }
    const clone = nameCell.cloneNode(true) as HTMLElement;
    clone.querySelector('[data-testid="required-asterisk"]')?.remove();
    if (textOf(clone) === name) {
      return row;
    }
  }
  return null;
}

function typeFromRow(row: HTMLElement): string | null {
  const cells = row.querySelectorAll('td');
  if (cells.length >= 3) {
    const typeText = textOf(cells[2]!);
    return typeText === '' ? null : typeText.toLowerCase();
  }
  return null;
}

function valueCell(row: HTMLElement): HTMLElement | null {
  const cells = row.querySelectorAll('td');
  return cells.length === 0 ? null : (cells[cells.length - 1] as HTMLElement);
}

function inferType(cell: HTMLElement): string {
  if (cell.querySelector('input[type="checkbox"], [role="switch"]')) {
    return 'boolean';
  }
  if (cell.querySelector('[aria-multiselectable="true"]')) {
    return 'list';
  }
  if (cell.querySelector('input[type="number"]')) {
    return 'number';
  }
  if (cell.querySelector('.gl-new-dropdown, [role="listbox"]')) {
    return 'dropdown';
  }
  return 'text';
}

function dropdownToggle(cell: HTMLElement): HTMLElement | null {
  return cell.querySelector<HTMLElement>(
    'button.gl-new-dropdown-toggle, button[data-testid="base-dropdown-toggle"], .gl-new-dropdown button',
  );
}

async function applyMultiSelect(toggle: HTMLElement, raw: string): Promise<boolean> {
  const doc = toggle.ownerDocument;
  toggle.click();
  await sleep(50);
  const items = collectListboxItems(doc);
  const options = items.map((item) => optionValue(item) || textOf(item));
  const desired = listSelection(raw, options);
  for (const item of items) {
    const token = optionValue(item) || textOf(item);
    const should = desired.includes(token);
    const checkbox = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const selected = item.getAttribute('aria-selected') === 'true' || checkbox?.checked === true;
    if (should !== selected) {
      item.click();
      await sleep(20);
    }
  }
  toggle.click();
  await sleep(50);
  return true;
}

export async function applyInputWidget(row: HTMLElement, raw: string): Promise<boolean> {
  const cell = valueCell(row);
  if (!cell) {
    return false;
  }
  const declared = typeFromRow(row);
  const kind = declared ?? inferType(cell);
  const checkbox = cell.querySelector<HTMLInputElement>('input[type="checkbox"]');
  const toggleSwitch = cell.querySelector<HTMLButtonElement>('[role="switch"]');
  const numberInput = cell.querySelector<HTMLInputElement>('input[type="number"]');
  const textarea = cell.querySelector<HTMLTextAreaElement>('textarea');
  const textInput = cell.querySelector<HTMLInputElement>(
    'input[type="text"], input:not([type]), input[type="search"]',
  );
  const boolButtons = Array.from(cell.querySelectorAll('button')).filter((button) => {
    const label = textOf(button).toLowerCase();
    return label === 'true' || label === 'false';
  });
  const listToggle = dropdownToggle(cell);

  if (kind === 'boolean' || checkbox || toggleSwitch || boolButtons.length >= 2) {
    const parsed = parseBooleanQuery(raw);
    if (parsed === null) {
      return false;
    }
    if (checkbox) {
      if (checkbox.checked !== parsed) {
        checkbox.click();
      }
      return true;
    }
    if (toggleSwitch) {
      const on = toggleSwitch.getAttribute('aria-checked') === 'true';
      if (on !== parsed) {
        toggleSwitch.click();
      }
      return true;
    }
    if (boolButtons.length >= 2) {
      const target = boolButtons.find((button) => textOf(button).toLowerCase() === String(parsed));
      if (!target) {
        return false;
      }
      const already =
        target.getAttribute('aria-pressed') === 'true' || target.classList.contains('selected');
      if (!already) {
        target.click();
      }
      return true;
    }
    if (listToggle) {
      return selectListboxOption(listToggle, String(parsed), false);
    }
    return false;
  }

  if (kind === 'array' || kind === 'list' || cell.querySelector('[aria-multiselectable="true"]')) {
    if (!listToggle) {
      return false;
    }
    return applyMultiSelect(listToggle, raw);
  }

  if (listToggle) {
    if (raw === '') {
      listToggle.click();
      await sleep(50);
      const items = collectListboxItems(row.ownerDocument);
      const empty = items.find((item) => textOf(item) === '' || optionValue(item) === '');
      if (!empty) {
        listToggle.click();
        return false;
      }
      empty.click();
      return true;
    }
    return selectListboxOption(listToggle, raw, false);
  }

  if (kind === 'number' || numberInput) {
    const el = numberInput ?? textInput;
    if (!el) {
      return false;
    }
    setNativeValue(el, raw);
    return true;
  }

  const el = textarea ?? textInput;
  if (!el) {
    return false;
  }
  setNativeValue(el, raw);
  return true;
}
```

Create `src/content/variables.ts`:

```ts
import { setNativeValue, sleep, textOf } from './dom';
import { selectListboxOption } from './listbox';
import { findPipelineFormRegion } from './wait';

export function variableRows(doc: Document): HTMLElement[] {
  return Array.from(doc.querySelectorAll<HTMLElement>('[data-testid="ci-variable-row-container"]'));
}

function keyInput(row: HTMLElement): HTMLInputElement | null {
  return row.querySelector('[data-testid="pipeline-form-ci-variable-key-field"]');
}

function valueInput(row: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  return row.querySelector(
    '[data-testid="pipeline-form-ci-variable-value-field"], [data-testid="pipeline-form-ci-variable-value-dropdown"] input, textarea',
  );
}

export function isFileVariableRow(row: HTMLElement): boolean {
  const typeEl = row.querySelector('[data-testid="pipeline-form-ci-variable-type"]');
  return textOf(typeEl).toLowerCase().includes('file');
}

export function findVariableRow(doc: Document, key: string): HTMLElement | null {
  for (const row of variableRows(doc)) {
    const input = keyInput(row);
    if (input && input.value === key) {
      return row;
    }
  }
  return null;
}

function findEmptyVariableRow(doc: Document): HTMLElement | null {
  for (const row of variableRows(doc)) {
    const input = keyInput(row);
    if (input && input.value === '') {
      return row;
    }
  }
  return null;
}

export async function setVariableRow(
  row: HTMLElement,
  key: string,
  value: string,
): Promise<boolean> {
  const keyEl = keyInput(row);
  if (!keyEl) {
    return false;
  }
  if (keyEl.value !== key) {
    setNativeValue(keyEl, key);
  }
  const dropToggle = row.querySelector<HTMLElement>(
    '[data-testid="pipeline-form-ci-variable-value-dropdown"] button',
  );
  if (dropToggle) {
    const selected = await selectListboxOption(dropToggle, value, true);
    if (selected) {
      return true;
    }
  }
  const valEl = valueInput(row);
  if (!valEl) {
    return false;
  }
  setNativeValue(valEl, value);
  return true;
}

export async function addVariable(doc: Document, key: string, value: string): Promise<void> {
  const empty = findEmptyVariableRow(doc);
  if (empty) {
    await setVariableRow(empty, key, value);
    return;
  }
  const root = findPipelineFormRegion(doc) ?? doc.body;
  const addButton = Array.from(root.querySelectorAll('button')).find((button) =>
    /add variable/i.test(textOf(button)),
  );
  if (addButton) {
    addButton.click();
    await sleep(80);
  }
  const row = findEmptyVariableRow(doc);
  if (row) {
    const ok = await setVariableRow(row, key, value);
    if (!ok) {
      return;
    }
  }
}
```

Create `src/content/fill.ts`:

```ts
import type { Param } from '../shared/query';
import { setBranchIfNeeded } from './branch';
import { isSkippedFillKey } from './fill-rules';
import { addVariable, findVariableRow, isFileVariableRow, setVariableRow } from './variables';
import { applyInputWidget, findInputRow } from './widgets';

export async function fillForm(doc: Document, params: Param[]): Promise<void> {
  const branch = params.find((param) => param.key === '_branch');
  if (branch) {
    await setBranchIfNeeded(doc, branch.value);
  }

  for (const { key, value } of params) {
    if (key === '_branch' || isSkippedFillKey(key)) {
      continue;
    }

    const inputRow = findInputRow(doc, key);
    if (inputRow) {
      await applyInputWidget(inputRow, value);
      continue;
    }

    const variableRow = findVariableRow(doc, key);
    if (variableRow) {
      if (isFileVariableRow(variableRow)) {
        continue;
      }
      const ok = await setVariableRow(variableRow, key, value);
      if (!ok) {
        continue;
      }
      continue;
    }

    try {
      await addVariable(doc, key, value);
    } catch {
      continue;
    }
  }
}
```

Replace `src/content/index.ts` with:

```ts
import { parseQuery } from '../shared/query';
import { fillForm } from './fill';
import { hasQueryParams, isRunNewPipelinePage } from './match';
import { waitForForm } from './wait';

(function gitlabPipelinePrefill(): void {
  let filling = false;
  let done = false;

  if (!isRunNewPipelinePage(window.location)) {
    return;
  }
  if (!hasQueryParams(window.location.search)) {
    return;
  }
  if (filling || done) {
    return;
  }

  filling = true;

  void (async () => {
    try {
      const ready = await waitForForm(document, 15_000);
      if (!ready) {
        console.warn('[GitLab Pipeline Prefill] Run new pipeline form not ready within 15s');
        return;
      }
      const params = parseQuery(window.location.search);
      if (params.length === 0) {
        return;
      }
      await fillForm(document, params);
    } finally {
      done = true;
      filling = false;
    }
  })();
})();
```

Cascade for each remaining key (stop when one step claims it):

1. Input row whose Name equals the key (exact, case-sensitive; `Email` ≠ `email`). Apply the value widget. If the widget cannot be applied (option missing, boolean not `true`/`false`, control missing): skip the key; do **not** create or update a Variable with the same name.
2. Else existing Variable row whose key field equals the query key (the blank new-variable row does not count). If type is **File**: skip; do not change type; do not add another row. Otherwise set the value (including `""`).
3. Else add a Variable row: type **Variable** (never File). Reuse the empty add row if empty; otherwise click GitLab’s add-variable control, then fill. If markup cannot add a row: skip that key and continue.

Widget rules:

- string/text: type the raw string (including empty) via the native value setter + bubbling `input` and `change`
- number: type the query string as-is; do not coerce
- boolean: `true`/`false` case-insensitive after trim. Set checkbox/switch/true-false button group/dropdown. If already in that state, do not click. Any other value → cannot apply
- single dropdown: option text or value, exact, case-sensitive; prefer value when they disagree; no match → cannot apply; empty query selects an empty option if one exists, else cannot apply
- list/array/multi-select: split with `splitListValues` / `listSelection`; select exactly the intersection; deselect the rest; missing tokens ignored; empty intersection clears selection; still applied (do not create a variable). Do not paste the comma-separated string into a text box
- Do not create File variables
- Never click **Run pipeline**, **New pipeline**, **Cancel**, **Select inputs**, or **Preview inputs**
- No toast or overlay; skip failures silently except the one form-ready `console.warn`

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run`

Expected: PASS (all unit tests in `src/**/*.test.ts`).

Then `npm run build` (exit 0). Reload unpacked `dist/`.

Manual on gitlab.com (project whose Run new pipeline page has Inputs string/list/boolean/number and Variables), from spec §10.2:

1. Open `/-/pipelines/new?_branch=main&email=user@example.com&tags=web,api&enabled=true&count=2&EXISTING_VAR=one&NEW_VAR=two` (adjust keys to the project). Confirm branch, string, list, boolean, and number inputs fill; an existing variable key is updated; an unknown key becomes a new Variable (not File).
2. Refresh (F5) and confirm fill runs again.
3. `_branch` set to a ref that is **not** in the dropdown: branch unchanged; other keys still fill.
4. Apply from a project tab such as `https://gitlab.com/group/proj/-/merge_requests`: tab goes to `/-/pipelines/new` with the profile query and the form fills.
5. Apply from `https://example.com` and from `https://gitlab.com/dashboard` (no `/-/`): red popup error; tab URL unchanged.
6. Confirm **Run pipeline** / **New pipeline** is never clicked by the extension.

Load unpacked reminder: `chrome://extensions` → Developer mode → Load unpacked → `d:\mycode\gitlab-pipeline-chrome-plugin\dist`. Rebuild with `npm run build` after each change, then click Reload on the extension card.

- [x] **Step 5: Commit**

```bash
git add src/content/widgets.ts src/content/variables.ts src/content/fill.ts src/content/fill.test.ts src/content/index.ts
git commit -m "feat: fill pipeline inputs and variables from the query"
```

---

## Self-review

### Spec coverage

| Spec | Task |
|---|---|
| §1 Purpose; never auto-run | 11, 15 |
| §2 Name and English copy | 6–11 |
| §3 Stack (MV3, TS strict, Vite, vanilla popup, Vitest, no SW) | 1, 6 |
| §4 Popup / content / shared; Apply is URL-only | 6–15 |
| §4.1 Source layout | 1, 6, 12–15 |
| §4.2 Manifest fields, icons, Chrome 116 | 6 |
| §5.1 Broad http(s) matches, `document_idle` | 6 |
| §5.2 Host/path gate; empty query exits | 12, 13 |
| §5.3 `storage` + `activeTab`; no `tabs`; no extra host_permissions | 6, 11 |
| §6.1 Types; storage shape | 1, 5, 7 |
| §6.2 parseQuery | 1 |
| §6.3 serializeParams | 1 |
| §6.4 List split | 2, 15 |
| §6.5 Project base + `buildPipelineNewUrl` | 3, 11 |
| §6.6 Reserved `_` keys | 12, 15 |
| §7.1 IIFE flags; no sessionStorage; refresh refills | 13–15 |
| §7.2 Form wait 15s + one `console.warn` | 13 |
| §7.3 Algorithm; stabilize 400ms/15s | 14, 15 |
| §7.4 Markup drift | 15 |
| §7.5 Widgets | 15 |
| §8.1 Storage defaults + stale id | 5, 7 |
| §8.2 Apply Chrome APIs | 11 |
| §8.3 Popup structure, 400px, Rows default, zero-profile shell | 6–10 |
| §8.4 Rows unique keys | 5, 9 |
| §8.5 Bulk validation | 4, 10 |
| §8.6 Not-a-project error | 11 |
| §9 Error table | 4, 10, 11, 13, 15 |
| §10.1 Unit tests | 1–4, 5, 12 |
| §10.2 Manual gitlab.com | 15 |
| §11 Out of scope | not implemented |
| §12 Allowed MutationObserver / native setters / Vite / Vitest | 6, 13–15 |

No extra products. One plan.

### Placeholder scan

No TBD, TODO, “implement later”, “similar to Task N”, or “add validation later” steps remain. Content-script DOM work is fully specified with selectors and complete source.

### Type consistency

Names used across tasks: `Param`, `Profile`, `StorageShape`, `parseQuery`, `serializeParams`, `splitListValues`, `projectBaseFromHref`, `buildPipelineNewUrl`, `isValidBulkText`, `nextDefaultName`, `normalizeStorage`, `createProfile`, `deleteProfile`, `tryUpdateRowKey`, `addEmptyRow`, `removeRowAt`, `updateRowValue`, `loadStorage`, `saveStorage`, `displayProfileName`, `isApplyDisabled`, `APPLY_NOT_PROJECT`, `decideApplyUrl`, `LocationLike`, `isRunNewPipelinePage`, `hasQueryParams`, `isSkippedFillKey`, `parseBooleanQuery`, `listSelection`, `pickOptionLike`, `setNativeValue`, `sleep`, `textOf`, `waitForForm`, `waitForStabilize`, `setBranchIfNeeded`, `fillForm`.
