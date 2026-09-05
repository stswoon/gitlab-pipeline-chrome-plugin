# Task: Popup named profiles and Apply

## Feature
Ship the first user-visible slice of **GitLab Pipeline Prefill**: a Manifest V3 toolbar popup where the user manages named profiles of query parameters and clicks **Apply** to open the current tab on `{projectBase}/-/pipelines/new` plus that profile’s query.

## Why this slice
Shared parse/serialize work is already planned (Task 1 in a worktree). The next product value is the popup the user actually clicks — not the content-script form fill.

## Source of truth
`docs/superpowers/plans/2026-09-05-gitlab-pipeline-chrome-plugin.md` — Global Constraints, user-facing copy, Tasks 5 and 7–11.

## Stack (do not replace)
Vanilla HTML/CSS/TypeScript popup. No React, Vue, Tailwind, shadcn, Zustand, Plasmo, or WXT — even if the default analyst template mentions them.

## In scope
- Profile CRUD and switch in the popup
- Rows editor for key/value params
- Persist `profiles` + `selectedProfileId` in `chrome.storage.local`
- Apply: resolve project base from the active tab and navigate to the new-pipeline URL
- Verbatim English copy from the plan

## Out of scope
- Content-script form filling (Inputs/Variables/branch)
- Bulk query editor
- Clicking **Run pipeline** / **Cancel**
- New permissions beyond `storage` + `activeTab`
