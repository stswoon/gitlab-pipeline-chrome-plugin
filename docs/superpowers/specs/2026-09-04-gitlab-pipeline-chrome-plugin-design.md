# GitLab Pipeline Prefill — Chrome extension design

Date: 2026-09-04

This spec is the source of truth for the first implementation. Follow it as written. Do not add features listed under Out of scope.

## 1. Purpose

A Chrome extension that prefills GitLab’s **Run new pipeline** form from the page URL’s query string, and a toolbar popup of named profiles that navigate to `/-/pipelines/new` with those query parameters.

The extension never clicks **Run pipeline**. The user reviews the filled form and runs the pipeline themselves.

## 2. Product name and UI language

- Extension name (manifest `name`, toolbar tooltip): `GitLab Pipeline Prefill`
- All popup copy is English.

## 3. Stack

- Manifest V3
- TypeScript (`strict: true`)
- Vite for bundling (not Plasmo, not WXT, not webpack-only)
- Popup: vanilla HTML, CSS, and TypeScript compiled to JS. No React, Vue, or other UI framework in the extension
- Content script drives the GitLab page DOM as a user would. No GitLab GraphQL, REST, or other internal APIs for filling
- No background service worker. No background script with business logic. Popup and content script are the only extension pages/scripts
- Shared TypeScript module imported by both popup and content-script bundles
- Unit tests: Vitest, parser/URL helpers only (no live GitLab)

## 4. Architecture

Three parts:

1. **Popup** — profile CRUD, rows/bulk editors, Apply. Persists to `chrome.storage.local`.
2. **Content script** — on the Run-new-pipeline page, reads `location.search` and fills the form. The popup never messages the content script.
3. **Shared query module** — parse/serialize query ↔ `params`, list-value split, project-base URL slice, pipeline URL build. Used by the popup (bulk ↔ rows, Apply URL) and the content script (`_branch` + remaining params).

Apply only changes the tab URL. The content script then runs as if the user had opened that URL (typed, bookmarked, or landed from Apply).

```mermaid
sequenceDiagram
  actor User
  participant Popup
  participant Tab
  participant Content as Content script
  participant DOM as GitLab DOM

  User->>Popup: Click Apply
  Popup->>Popup: Read active tab URL
  alt URL has no "/-/" (before query/hash)
    Popup-->>User: Red error text; do not navigate
  else URL has "/-/"
    Popup->>Tab: tabs.update to "{base}/-/pipelines/new" plus profile query
    Tab->>Content: Document loads; content script injects
    Content->>Content: Exit unless host, path, and query match
    Content->>DOM: Wait for form; set branch; fill inputs then variables
  end
```

Direct visit (no popup): user opens `…/-/pipelines/new?_branch=main&email=a@b.c` → content script fills the same way.

### 4.1 Source layout

```
package.json
manifest.json
vite.config.ts
tsconfig.json
src/shared/query.ts
src/shared/query.test.ts
src/popup/index.html
src/popup/main.ts
src/popup/popup.css
src/content/index.ts
public/icons/icon16.png
public/icons/icon32.png
public/icons/icon48.png
public/icons/icon128.png
```

npm is the package manager. `package.json` `version` is `0.1.0`. Vite builds two bundles: popup (from `src/popup/index.html`) and content script (IIFE/single file, no ESM imports at runtime). Copy `manifest.json` and icons into `dist/`. Load unpacked `dist/` in Chrome.

Content-script format is IIFE so `filling` / `done` stay in that file’s closure and nothing leaks onto the page.

### 4.2 Manifest (normative fields)

- `manifest_version`: `3`
- `name`: `GitLab Pipeline Prefill`
- `version`: `0.1.0`
- `description`: `Prefill GitLab Run new pipeline from URL query parameters and named profiles.`
- `permissions`: `["storage", "activeTab"]` only
- `action.default_popup`: built popup HTML
- `action.default_title`: `GitLab Pipeline Prefill`
- `action.default_icon` / `icons`: the PNGs in `public/icons/`
- `content_scripts`: one entry as in §5.1
- No `background` key
- No `options_page` / `options_ui`

Icons are a simple generic play/pipeline mark (16/32/48/128 PNG). Do not use GitLab’s tanuki logo.

Minimum Chrome: 116.

## 5. Hosts, matching, permissions

Chrome match patterns cannot express “hostname contains `gitlab`”. Register the content script broadly, then **exit immediately** when the page is not a GitLab Run-new-pipeline URL.

### 5.1 Manifest content script

- `matches`: `http://*/*` and `https://*/*` only (HTTP and HTTPS; not `file:`)
- `run_at`: `document_idle`
- `js`: the built content-script file

This injects on every http(s) page. The first statements of the content script must return if the page does not match §5.2. Do not attach observers or touch the DOM on non-matching pages.

### 5.2 Page match (content script)

All of the following must be true. Otherwise return immediately.

1. `location.protocol` is `http:` or `https:`
2. `location.hostname` contains `gitlab` **case-insensitively** (`gitlab.com`, `gitlab.company.com`, `GitLab.example.com`)
3. `location.pathname` matches `/\/-\/pipelines\/new\/?$/` (optional trailing slash; do not match a longer suffix such as `/-/pipelines/new/foo`)

If the page matches §5.2 but `location.search` has no parameters (`""`, `"?"`, or `URLSearchParams` with size 0), return immediately. Do not wait for the form.

### 5.3 Permissions

- `storage` — profiles
- `activeTab` — read the active tab URL and call `chrome.tabs.update` on it after the user clicks Apply (user gesture)

Do **not** request the `tabs` permission. Do **not** add a background service worker to compensate.

`host_permissions` are not listed separately; content-script `matches` already cover injection. Do not request `<all_urls>` beyond those two match patterns.

## 6. Shared query module

Keys that start with `_` are reserved. The only reserved key implemented now is `_branch`.

### 6.1 Types

```ts
type Param = { key: string; value: string };

type Profile = {
  id: string;       // crypto.randomUUID()
  name: string;
  params: Param[];  // row order = query order
};

type StorageShape = {
  profiles: Profile[];
  selectedProfileId: string | null;
};
```

`chrome.storage.local` holds exactly `profiles` and `selectedProfileId`. Bulk text is a **view** of `params`, not a second stored field.

### 6.2 Parse query → params

Input: a string. Behavior:

1. Trim ASCII whitespace.
2. If it starts with `?`, strip one leading `?`.
3. Parse with `URLSearchParams` (standard encoding: `+` is space, `%XX` decoded).
4. Walk entries **left to right**. Duplicate keys: **last value wins**, but the key **keeps the position of its first occurrence**.
   - Example: `a=1&b=2&a=3` → `[{ key: "a", value: "3" }, { key: "b", value: "2" }]`
5. Empty input, `?` only, or no pairs → `[]`.
Leading `?` is optional. `?_branch=main&a=1` and `_branch=main&a=1` parse the same.

`parseQuery` always returns `Param[]` and does not throw. Bulk-text rejection is a separate function (`isValidBulkText`, §8.5).

### 6.3 Serialize params → query

- Skip entries whose `key` is empty (after trim of the key only). Keep entries whose `value` is `""`.
- Encode with `URLSearchParams` in array order.
- Result for Apply and for Bulk view: a string starting with `?` when there is at least one kept pair; otherwise `""` (no `?`).
- Example: `[{_branch, main}, {a, 1}, {b, 2}, {c, 3}]` → `?_branch=main&a=1&b=2&c=3`

### 6.4 List values

When filling a list / multi-select **input widget**, split the raw query value:

- Split on `,`
- Trim whitespace on each token
- Drop empty tokens

Examples: `web,api` → `["web", "api"]`; `web, api` → `["web", "api"]`; `web` → `["web"]`; `""` and `,,,` → `[]`.

Do not split when filling a string/number input or a variable. Variables receive the raw string, commas included.

### 6.5 Project base URL (Apply)

Given the active tab’s `href`:

1. Strip fragment (`#...`).
2. Strip query (`?...`).
3. Find the **first** substring `/-/` in what remains.
4. If not found, return `null` (Apply must not navigate).
5. If found, return the substring **before** that `/-/` (scheme, host, port, project path). Do not include a trailing slash after the project path unless it was already before `/-/`.

Examples:

| Tab URL | Result |
|---|---|
| `https://gitlab.com/acme/app/-/pipelines` | `https://gitlab.com/acme/app` |
| `https://gitlab.com/group/sub/proj/-/pipelines/new` | `https://gitlab.com/group/sub/proj` |
| `https://gitlab.example.com:8443/g/p/-/jobs/1` | `https://gitlab.example.com:8443/g/p` |
| `https://gitlab.com/acme/app/-/pipelines/new?x=1#y` | `https://gitlab.com/acme/app` |
| `https://example.com/foo` | `null` |
| `https://gitlab.com/dashboard` | `null` |

`buildPipelineNewUrl(tabHref, params)`: if project base is `null`, return `null`; else return `{base}/-/pipelines/new` concatenated with §6.3 (`?…` or `""`).

### 6.6 Reserved keys at fill time

- `_branch`: used only for the branch/tag control. Never written to Inputs or Variables.
- Any other key that starts with `_`: ignore during fill (do not cascade). The popup may still store those rows; they appear in the URL if the user added them, and the content script skips them.

## 7. Content script fill

### 7.1 Lifecycle and idempotency

Do **not** use `sessionStorage`, `localStorage`, or page cookies to record that a fill ran. A sessionStorage flag would survive F5 and block re-apply on refresh. Refresh must fill again.

Keep two booleans in the **content script closure only**: `filling` and `done`.

The IIFE runs this once:

1. If the page fails §5.2, return (do not set flags, do not observe).
2. If the query has no parameters, return (do not set flags, do not observe).
3. If `filling` or `done` is true, return.
4. Set `filling = true`, then wait for the form and fill.
5. When fill finishes **or** the 15s form-ready timeout fires, set `done = true` and `filling = false`.

Do not start a second fill from MutationObserver callbacks. The observer is only a wait mechanism inside the single fill already in progress. Do not watch `location.search` for later SPA query changes.

Vue re-renders in the **same document** must not start another fill (`done` is true). A full reload destroys the JS context; both flags start false; fill runs again.

`chrome.tabs.update` to the constructed URL is a normal top-level navigation. A new document means a new content-script instance. If Chrome does not reload because the href is already identical, do nothing extra (no cache-buster). The user can refresh to re-fill.

### 7.2 Wait for the form

After §5.2 and a non-empty query:

Wait until the Run-new-pipeline form is present:

- The **Run for branch name or tag** control exists
- The **Variables** section exists (key/value rows or the add-variable controls)
- If an **Inputs** heading/section exists, wait until that section has finished its initial render (table present, or an explicit empty-inputs state). If the page has no Inputs section, that is valid; do not wait for one

Timeout: **15_000 ms** from the start of this wait. On timeout: stop, do not fill, set `done`, log **one** line from the extension, leave the page usable:

```text
[GitLab Pipeline Prefill] Run new pipeline form not ready within 15s
```

Use `console.warn` for that single line. No toast, no overlay, no injected banner.

Wait implementation: `document_idle`, a `MutationObserver` on `document.body`, and a 15s `setTimeout`. Disconnect the observer when the wait ends (ready or timeout). Do not poll on an interval.

### 7.3 Algorithm (after the form is ready)

Parse `location.search` with §6.2. If the resulting list is empty, return (and mark `done`).

Process **`_branch` first** if that key is present (any position in the list):

1. If the control already displays a ref whose text or value equals `_branch` (exact, case-sensitive), do not open or change the control and do not wait for stabilize.
2. Otherwise set **Run for branch name or tag** to the option whose visible text **or** option value equals `_branch`’s value, **exact and case-sensitive** (open the control and click that option, as a user would).
3. If no such option exists, **do not change** the current branch. Continue with remaining keys (no stabilize wait).
4. If the branch **was** changed, **wait for the DOM to stabilize** before touching Inputs or Variables:
   - No loading spinner visible in the pipeline form region (the new-pipeline form, not the GitLab sidebar/nav)
   - Inputs table row count (if Inputs exists) and variable rows stop changing
   - Operational definition: that form region has had **no mutations for 400 ms**, spinner absent, deadline **15_000 ms** from the start of this stabilize wait
   - If stabilize times out: **continue filling** with the DOM as it currently is (the form was already considered ready). Do not abort the whole fill. Do not log a second timeout line

Then walk **remaining keys in URL/parse order** (the §6.2 array). Skip `_branch`, any other key that starts with `_`, and any entry whose `key` is empty.

For each key, run this cascade. Stop the cascade for that key as soon as one step claims it.

1. **Input by name exists** (a currently rendered Inputs table row whose **Name** equals the key, exact and case-sensitive: `Email` ≠ `email`):
   - Apply the value to that row’s value widget (§7.5).
   - If the widget cannot be applied (option missing, boolean not `true`/`false`, control not found after the row was identified): **skip this key**. Do **not** also create or update a Variable with the same name.
   - Key is done.
2. Else **an existing Variable row has that key** (the key field’s current value equals the query key, exact and case-sensitive). The blank “new variable” row with an empty key does not count:
   - If that row’s type is **File**: skip the key; do not change type; do not add another row.
   - Otherwise set the value (including `""`). Do not add another row.
   - Key is done.
3. Else **add a Variable row**:
   - Type **Variable**, never **File**. Do not change an existing row’s type to File.
   - Set key and value (value may be `""`).
   - Reuse the empty add row if it is empty; otherwise use GitLab’s add-variable control, then fill the new row.
   - Key is done.

Never click **Run pipeline**. Never click **Cancel**. Do not open **Select inputs** / **Preview inputs**; only Inputs rows already visible in the table count as “input exists”.

No toast and no overlay on the GitLab page. Skip failures silently except the one form-ready `console.warn`.

### 7.4 Markup drift

- If a row was identified as an Input by **name** but the value widget cannot be found or set: skip; do not fall through to Variables.
- If no Input row with that name was identified: continue the cascade to Variables.
- If GitLab’s Variables markup cannot be used to add a row: skip that key; continue other keys; do not throw into the page.

### 7.5 Widgets

Name matching for inputs is exact and case-sensitive.

Set values; do not toggle blindly. Dispatch DOM events so GitLab’s Vue app accepts the change: assign via the native `HTMLInputElement`/`HTMLTextAreaElement` value setter (not only the Vue-wrapped property), then `dispatchEvent` `input` and `change` (`bubbles: true`). For dropdowns and multi-selects, open the control and click matching options the way a user would.

Detect the widget from the Inputs **Type** column when present (`string`, `number`, `boolean`, `array`). If Type is absent, infer: checkbox/toggle → boolean; multi-select → list; `input[type=number]` → number; single select → dropdown; otherwise text.

| Input type | Query value | Action |
|---|---|---|
| string / text | any string, including empty | Type into the field |
| number | the query string as-is | Type into the field; do not coerce or skip on non-numeric text |
| boolean | `true` or `false`, case-insensitive, after trim | **Set** the control to on/off. If already in that state, do not click. If the value is anything else, treat as cannot apply (§7.3 step 1 skip) |
| single dropdown / select | string | Select the option whose **text or value** equals the query string, exact and case-sensitive. Prefer value match if a value match and a label match would pick different options. If no option matches: cannot apply |
| list / array / multi-select | normal query string; multiple values **comma-separated** (`?tags=web` or `?tags=web,api`) | **Select** options in the GitLab UI. Do not paste the comma-separated string into a text box. Set selected options to **exactly** the intersection of §6.4 tokens and existing options (case-sensitive); deselect the rest. Missing tokens are ignored; the key is still applied (do not create a variable). If the intersection is empty, clear the selection. |

Empty query value (`?foo=`):

- Variable: write `""`
- Text/number input: write `""`
- List input: select no options
- Boolean: `""` is not `true`/`false` → cannot apply if it is an identified input
- Single dropdown: select an option with empty text/value if it exists; else cannot apply

Do not create File variables.

## 8. Popup and profiles

All configuration lives in the **toolbar popup**. No Options page.

### 8.1 Storage defaults

On first install: `profiles: []`, `selectedProfileId: null`. Do not seed a default profile.

If `selectedProfileId` is not `null` and does not match any profile (corrupt/stale data): set it to the first profile’s `id` if the list is non-empty, else `null`, and write back.

### 8.2 Chrome APIs on Apply

On Apply click (user gesture):

1. `chrome.tabs.query({ active: true, currentWindow: true })` to get the active tab (`activeTab`).
2. If there is no tab, or `tab.url` is missing, show the not-a-project error and do not navigate.
3. `destination = buildPipelineNewUrl(tab.url, selectedProfile.params)` (§6.5). If `null`, show the not-a-project error and **do not** call `tabs.update`. If there is no selected profile, Apply is disabled and this path is unreachable.
4. `chrome.tabs.update(tab.id, { url: destination })`.

### 8.3 UI structure

Popup width: `400px`. View mode (Rows vs Bulk) is in-memory only; each time the popup opens, start on **Rows**.

Sections, in order:

1. **Profile switcher** — `<select>` of profile names (display `Untitled` when `name` is `""`, storage still stores `""`). Changing the select sets `selectedProfileId` and shows that profile. If the popup is on Bulk, load that profile’s serialized params into the textarea (invalid text from the previous profile is discarded).
2. **Name** — text field bound to `profile.name`; persist on `input`.
3. **Create** — button `New profile`. Appends `{ id: crypto.randomUUID(), name: nextDefaultName(), params: [] }`, selects it, persists. `nextDefaultName()` is `Profile 1`, `Profile 2`, … the smallest positive integer `N` such that no existing profile name is exactly `Profile N`.
4. **Delete** — button `Delete`. Enabled only when a profile is selected. Deletes **immediately**, no confirm dialog. After delete: select the profile at the deleted index (the old next neighbor); if that index is past the end, select the new last profile; if the list is empty, `selectedProfileId = null`. Persist.
5. **View toggle** — `Rows` | `Bulk`. Only the selected profile’s params.
6. **Rows view** — list of key/value text fields, button `Add row`, per-row `Remove`. `_branch` is an ordinary row whose key is `_branch` (no special widget).
7. **Bulk view** — one textarea. When switching from Rows to Bulk, set the textarea to §6.3 serialize of current `params` (example `?_branch=main&a=1&b=2&c=3`).
8. **Error line** — empty, or red text (`#c62828`). Used for invalid bulk, duplicate keys, and not-a-project Apply. Clear the not-a-project error when the user edits profiles or when Apply navigates. Invalid-bulk error follows §8.5.
9. **Apply** — primary button `Apply`. Disabled when there are zero profiles or when Bulk text is currently invalid (§8.5). No extra confirmation.

Zero profiles: show `New profile` and a disabled `Apply`. Hide the switcher, name field, Delete, view toggle, Rows, and Bulk. No error text for this state.

### 8.4 Rows rules

- **Add row** appends `{ key: "", value: "" }`. Multiple empty keys are allowed while editing.
- Non-empty keys in a profile are **unique**. Changing a key to one that another row already uses (exact, case-sensitive) is rejected: do not persist the duplicate; show `Keys must be unique.` in the error line; keep the previous key in that row. **Add row** does not copy an existing non-empty key.
- Remove row is immediate.
- Persist `params` on each successful row edit (`chrome.storage.local`).
- Apply (and serialize) skip empty keys and keep empty values.

### 8.5 Bulk rules

Bulk is not a second store. Switching Rows ↔ Bulk converts through §6.2 / §6.3.

`isValidBulkText(raw)` (shared module; unit-test this). Trim the string, then:

- `""` and `"?"` are **valid** (zero params)
- Invalid if the trimmed string contains `#`
- Invalid if the trimmed string contains any ASCII whitespace (`[ \t\n\r]`) — values with spaces must use `+` or `%20` (`a=hello%20world` is valid; `a=hello world` is not)
- After stripping one leading `?`, split on `&`. Ignore empty segments (`a=1&` is valid). A segment is an empty key (invalid) if it is `=`/`=value` (`&=1`, `?a=1&=2`). A segment with no `=` is key-only with value `""` and is valid.

`URLSearchParams` alone is too lenient for empty keys; reject empty keys explicitly.

On invalid bulk:

- Show `Invalid query string.` in the error line
- Do **not** write `params`
- Stay on Bulk (clicking **Rows** does not switch until the text parses)
- Disable **Apply**
- Keep the invalid text in the textarea only (memory). Switching profiles discards it and loads the other profile’s params

On each bulk `input`, if the text is valid:

- Parse (§6.2); duplicate keys already collapsed (last value, first position)
- Write `params` to the selected profile
- Clear the invalid-bulk error
- Enable Apply (if a profile is selected)

Valid bulk may omit `?`.

### 8.6 Apply off a GitLab project

If §6.5 returns `null`:

- Red error: `This tab is not a GitLab project. Open a project page and try Apply again.`
- Do not change the tab URL

Hostname does not need to contain `gitlab` for Apply slicing; the test is only the `/-/` project separator. A GitLab project tab such as `https://gitlab.com/group/proj/-/merge_requests` succeeds. `https://github.com/org/repo` fails (no `/-/`). `https://gitlab.com/dashboard` fails (no `/-/`).

## 9. Errors (summary)

| Situation | Behavior |
|---|---|
| `/-/pipelines/new` with no query | Content script exits; page unchanged |
| Form not ready in 15s | Stop fill; one `console.warn`; page unchanged otherwise |
| `_branch` not in the ref dropdown | Leave branch as-is; fill remaining keys |
| Apply while tab URL has no `/-/` | Popup red error; no navigation |
| Invalid bulk | Popup error; `params` in storage unchanged |
| Input identified but value cannot be applied | Skip key; do not create a same-name variable |
| Input never identified | Cascade to existing then new variables |
| Existing File variable with that key | Skip; do not add a Variable row with the same key |
| Profile values in storage | Plain `chrome.storage.local` on the machine; **not encrypted**. Do not claim otherwise in the UI |

## 10. Testing

### 10.1 Unit (Vitest, no live GitLab)

Cover `src/shared/query.ts`:

**query ↔ params**

- `?` optional: `?a=1` and `a=1` → same
- Order preserved
- Duplicate keys → last value, first-seen position: `a=1&b=2&a=3`
- `_branch` is a normal key in the array
- Empty value kept: `a=` → `{ key: "a", value: "" }`
- Empty keys skipped on serialize
- Serialize leading `?` when non-empty

**list split**

- `web,api` → `["web", "api"]`
- `web, api` → `["web", "api"]`
- empty / only commas → `[]`

**URL slice up to `/-/`**

- Normal project: `https://gitlab.com/acme/app/-/pipelines` → `https://gitlab.com/acme/app`
- Nested group: `https://gitlab.com/a/b/c/-/pipelines/new` → `https://gitlab.com/a/b/c`
- Missing `/-/`: `https://example.com/foo` → `null`
- Query and hash ignored when finding `/-/`

**isValidBulkText**

- `?_branch=main&a=1` and `_branch=main&a=1` valid
- `""` valid
- `a=hello world` invalid
- `&=1` invalid
- `a=1#x` invalid

### 10.2 Manual on gitlab.com

Use a project whose **Run new pipeline** page has Inputs (string, list, boolean, number) and Variables.

1. Open `/-/pipelines/new?_branch=main&email=user@example.com&tags=web,api&enabled=true&count=2&EXISTING_VAR=one&NEW_VAR=two` (adjust keys to the project’s Inputs and Variables). Confirm branch, string, list, boolean, and number inputs fill; an existing variable key is updated; an unknown key becomes a new Variable (not File).
2. Refresh (F5) and confirm fill runs again.
3. `_branch` set to a ref that is **not** in the dropdown: branch unchanged; other keys still fill.
4. Apply from a project tab such as `https://gitlab.com/group/proj/-/merge_requests`: tab goes to `/-/pipelines/new` with the profile query and the form fills.
5. Apply from `https://example.com` and from `https://gitlab.com/dashboard` (no `/-/`): red popup error; tab URL unchanged.
6. Confirm **Run pipeline** is never clicked by the extension.

## 11. Out of scope

- Auto-running the pipeline (clicking **Run pipeline**)
- Per-profile repository URL
- Options page
- Firefox / other browsers
- Encrypting secrets
- Filling via GraphQL or GitLab APIs
- React (or other UI frameworks) in the extension
- Creating or switching to File variables
- Toast / overlay on the GitLab page
- Reserved `_` keys other than `_branch` (unknown `_…` keys are ignored at fill; no extra reserved semantics)
- Messaging from popup to content script
- `sessionStorage` (or any persistent) fill guard
- Background worker business logic
- Broad `tabs` permission

## 12. Implementation notes (non-goals vs allowed)

Allowed: MutationObserver, native value setters, click/select on GitLab widgets, Vite, Vitest, `activeTab` + `tabs.update` from the popup.

Not allowed: Plasmo, WXT, a React popup, a service worker that stores profiles or fills forms, `chrome.scripting.executeScript` as a substitute for the declared content script, encrypting `chrome.storage.local`.
