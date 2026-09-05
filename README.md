# GitLab Pipeline Prefill

Chrome extension (Manifest V3) that prefills GitLab’s **Run new pipeline** form from saved profiles or a query string.
It never clicks **Run pipeline**, **Cancel**, **Select inputs**, or **Preview inputs**.

## Build and load unpacked

```bash
npm install
npm test
npm run build
```

In Chrome: open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the `dist/`
folder.

## Query syntax

Apply navigates the active tab to `/-/pipelines/new` with profile values as query parameters:

- `_branch` — branch or tag for **Run for branch name or tag** (other keys starting with `_` are reserved and skipped).
- Comma-separated values fill multi-select inputs.
- `true` / `false` (case-insensitive) fill boolean inputs.

## Proof

![](docs/proof.png)
