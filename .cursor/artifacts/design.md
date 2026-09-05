# Design: Popup named profiles and Apply

## UI/UX

Popup **400px**, `lang="en"`, system-ui 13px, цвет текста `#1f1f1f`, padding `#app` 12px, вертикальный стек `gap: 8px`. Каркас и id — verbatim из плана Task 6 (`src/popup/index.html` + `src/popup/popup.css`). Не вводить React/Tailwind/shadcn/Zustand.

### Разметка сверху вниз

1. **Profile switcher** — `#profile-switcher-wrap`: label `Profile`, `<select id="profile-select">`. Option `value` = `profile.id`, текст = `displayProfileName(profile.name)` (`Untitled` если `name === ""`).
2. **Name** — `#name-wrap`: label `Name`, `<input id="profile-name" type="text">`. Значение = сырой `profile.name` (пустое поле, не `Untitled`).
3. **Toolbar** — `#btn-new-profile` = `New profile` (всегда видна); `#btn-delete` = `Delete` (disabled, если нет выбранного профиля).
4. **View toggle** — `#view-toggle-wrap`: `#btn-view-rows` = `Rows` (`aria-pressed="true"`); `#btn-view-bulk` = `Bulk` (`aria-pressed="false"`). В этом срезе Bulk не подключать. `#rows-view` показан при выбранном профиле; `#bulk-view` остаётся `hidden`.
5. **Rows** — `#rows-list` из `.kv-row` (grid: key | value | Remove). Поля: `type="text"`, `aria-label` `Key` / `Value`. Под списком `#btn-add-row` = `Add row`.
6. **Error** — `#error-line` (`min-height: 1.2em`, цвет `#c62828`). Пусто, либо `Keys must be unique.`, либо `This tab is not a GitLab project. Open a project page and try Apply again.`
7. **Apply** — `#btn-apply` = `Apply` (`font-weight: 700`). Disabled: `isApplyDisabled(profiles.length, false)` — только при нуле профилей. Extra confirmation нет.

Disabled-кнопки: `opacity: 0.5`.

### Zero-profile shell

`#app` имеет класс `is-empty`. CSS прячет: `#profile-switcher-wrap`, `#name-wrap`, `#btn-delete`, `#view-toggle-wrap`, `#rows-view`, `#bulk-view`.

Видно только **New profile** и disabled **Apply**. `#error-line` пустой. Нет switcher, Name, Delete, Rows/Bulk.

### После создания профиля

Снять `is-empty`. Select показывает `Profile 1`, name field = `Profile 1`, **Delete** и **Apply** enabled, Rows виден (список может быть пустым). Вид всегда Rows при каждом открытии popup (in-memory mode не нужен, пока Bulk не в scope).

## Состояния и переходы

Состояние приложения = `StorageShape` + `errorText` (только UI, не в storage). Отдельного loading-экрана нет: `init` делает `loadStorage()` и сразу `render()`.

```
loadStorage()
  ├─ profiles.length === 0  → ZeroProfile
  └─ иначе                  → Editor (Rows, выбран selectedProfileId)

ZeroProfile
  New profile → createProfile → persist → Editor (новый id выбран)
  Apply       → недоступен (disabled)

Editor
  New profile     → append Profile N, select created, persist, render
  Delete          → deleteProfile (без confirm) → persist
                    ├─ остались профили → Editor (сосед / новый last)
                    └─ список пуст      → ZeroProfile
  Switch select   → selectedProfileId = option.value, persist, render Rows
  Name input      → profile.name = value, persist; option text = displayProfileName
  Add row         → append { key: "", value: "" }, persist, render
  Key input OK    → params обновлены, persist; если error был Keys must be unique. — сбросить
  Key input dup   → params не менять, input вернуть к старому key, error Keys must be unique.
  Value input     → updateRowValue, persist (без смены ключа)
  Remove          → removeRowAt, persist, render
  Apply + project → tabs.update, error очистить
  Apply + не проект / нет tab.id / нет tab.url → error APPLY_NOT_PROJECT, URL таба не менять
  Любая правка профиля (create/delete/switch/rename/row) → если error === APPLY_NOT_PROJECT, очистить
```

`chrome.storage.local` всегда `{ profiles, selectedProfileId }` и ничего больше.

## Поведение / бизнес-правила

### Storage (Task 5 + 7)

- `normalizeStorage(raw)`: не-профили отфильтровать; отсутствующие поля → `{ profiles: [], selectedProfileId: null }`; stale id → первый профиль или `null`; `didRepair: true` если чинили.
- `loadStorage()`: `chrome.storage.local.get(['profiles', 'selectedProfileId'])` → normalize; если `didRepair` **или** `raw.profiles === undefined` — `saveStorage(value)`.
- `saveStorage(data)`: `set` только `profiles` и `selectedProfileId`.
- Не сидировать профиль при first install.

### Create / default name (Task 5 + 8)

- `createProfile`: `{ id: crypto.randomUUID(), name: nextDefaultName(profiles), params: [] }`, append, выбрать `created.id`.
- `nextDefaultName`: наименьший положительный `N` такой, что ни у одного профиля имя **точно** `Profile N`. `profile 1` и `Profile 1 ` не считаются занятыми → можно снова `Profile 1`.

### Delete (Task 5 + 8)

- Без confirm dialog.
- Удаляется **выбранный** профиль (`deleteId === selectedProfileId`).
- Если удалили выбранный: взять элемент на старом индексе (бывший next neighbor); если индекс за концом — новый last; если пусто — `selectedProfileId = null`.
- Если бы удаляли чужой id — selection сохранилась бы; в UI этот путь не вызывается.

### Display name (Task 8)

- `displayProfileName("")` → `Untitled` только в select.
- Инпут имени показывает `""`. Storage хранит `""`.

### Rows (Task 5 + 9)

- **Add row** всегда `{ key: "", value: "" }` в конец. Не копирует существующий непустой ключ.
- `tryUpdateRowKey`: если `nextKey !== ""` и другой индекс уже имеет тот же ключ → `{ params: прежние, error: "Keys must be unique." }`. Иначе обновить ключ, `error: null`.
- `_branch` — обычный ключ; дубликат `_branch` отклоняется так же.
- **Remove** сразу, без confirm.
- Persist на каждом **успешном** edit (ключ принят, value, add, remove).
- Apply/serialize пропускает пустые ключи и оставляет пустые values.

### Apply disabled (Task 8 + 11)

- `isApplyDisabled(profileCount, bulkInvalid)`: `profileCount === 0 || bulkInvalid`.
- В этом срезе всегда `bulkInvalid === false`. **Apply** disabled только при нуле профилей.
- Дубликат ключа **не** дизейблит Apply (ошибка в `#error-line`, `params` без дубликата).

### Apply navigation (Task 3 + 11)

Константа и решение URL — `src/popup/apply-url.ts`, не локальная копия строки:

`APPLY_NOT_PROJECT` = `This tab is not a GitLab project. Open a project page and try Apply again.`

`decideApplyUrl(tabUrl, params)`:

- `tabUrl` отсутствует → `{ error: APPLY_NOT_PROJECT }`
- `buildPipelineNewUrl(tabUrl, params) === null` → тот же error
- иначе `{ url }`

`buildPipelineNewUrl`: `projectBaseFromHref` (отрезать `#` затем `?`, первая `/-/`, base = всё до неё) + `/-/pipelines/new` + `serializeParams(params)`. Пустой serialize → без `?`.

Примеры base:

| Tab URL | Base / Apply |
|---|---|
| `https://gitlab.com/acme/app/-/pipelines` | `https://gitlab.com/acme/app` |
| `https://gitlab.com/group/sub/proj/-/pipelines/new` | `https://gitlab.com/group/sub/proj` |
| `https://gitlab.example.com:8443/g/p/-/jobs/1` | `https://gitlab.example.com:8443/g/p` |
| `https://gitlab.com/acme/app/-/pipelines/new?x=1#y` | `https://gitlab.com/acme/app` |
| `https://example.com/foo` | не проект |
| `https://gitlab.com/dashboard` | не проект |
| `https://github.com/org/repo` | не проект (нет `/-/`) |

Клик **Apply** (user gesture, `activeTab`):

1. Нет выбранного профиля → return (кнопка disabled).
2. `chrome.tabs.query({ active: true, currentWindow: true })`.
3. Нет `tab?.id` → `setError(APPLY_NOT_PROJECT)`, не навигировать.
4. `decideApplyUrl(tab.url, profile.params)`.
5. Error → показать, не вызывать `tabs.update`.
6. Success → `setError('')`, `chrome.tabs.update(tab.id, { url })`.

Не добавлять cache-buster. Popup не шлёт сообщений content script. Форма GitLab в этом срезе не заполняется (stub / out of scope).

### Manifest / permissions (нужны для popup)

- `permissions`: `["storage", "activeTab"]` only.
- Нет `tabs` permission.
- Нет `background`.
- Content-script match в манифесте может остаться как в плане (`http://*/*`, `https://*/*` + no-op IIFE), но fill **не** реализуется.

## E2E-сценарии (для Lead, шаг 5)

Проверка по плану Tasks 7–9, 11 (без Bulk и без fill).

1. **Zero-profile shell.** Свежий `chrome.storage.local` / first install. Открыть popup: только **New profile** и disabled **Apply**. Нет error text, нет switcher/Name/Delete/Rows.
2. **Create + default names.** **New profile** → select и name = `Profile 1`, Delete/Apply enabled, Rows виден. Второй **New profile** → выбран `Profile 2`.
3. **Untitled.** Очистить name: select показывает `Untitled`; в storage `name` это `""`. Повторно открыть popup — то же.
4. **Switch persist.** Выбрать другой профиль в select, закрыть/открыть popup — `selectedProfileId` тот же, его rows на месте. Старт всегда на Rows.
5. **Delete neighbor / last.** Три профиля A,B,C; выбран B; **Delete** без confirm → список A,C, выбран C. Удалять до одного, затем последнего → ZeroProfile.
6. **Add / edit / persist rows.** **Add row** → пустые Key/Value. Ввести уникальный key `email` и value `a@b.c`. Переоткрыть popup — строка на месте. `_branch` вводится как обычный key.
7. **Duplicate key.** Строки `_branch=main` и `a=1`. Во второй ключ ввести `_branch` → поле откатывается на `a`, `#error-line` = `Keys must be unique.`, storage без дубликата.
8. **Remove.** **Remove** сразу удаляет строку; persist.
9. **Empty keys omitted on Apply.** Профиль с пустой строкой и `a=1`. Apply на проектном табе → query содержит `a`, пустой ключ не попадает; профиль без непустых ключей → URL `{base}/-/pipelines/new` без `?`.
10. **Apply на проекте.** Активный таб `https://gitlab.com/group/proj/-/merge_requests` (любой реальный project URL с `/-/`), params `_branch=main`, `email=a@b.c` → таб становится `https://gitlab.com/group/proj/-/pipelines/new?_branch=main&email=a%40b.c`. Hostname без `gitlab`, но с `/-/`, тоже успешен.
11. **Apply не проект.** На `https://example.com` и `https://gitlab.com/dashboard`: `#error-line` = `This tab is not a GitLab project. Open a project page and try Apply again.` цветом `#c62828`; URL таба не меняется. Нет `tab.url` / нет `tab.id` — та же ошибка.
12. **Clear Apply error.** После ошибки из п.11 правка name или row очищает `#error-line`. Успешный Apply тоже очищает.
13. **Apply disabled.** Zero profiles → Apply disabled. После создания профиля — enabled (Bulk invalid в этом срезе не возникает).
14. **No auto-run.** После Apply расширение не кликает **Run pipeline** / **Cancel**.

## Sunny-day сценарии (для SA, шаг 7)

Те же пользовательские пути, что в `requirements.md`. Приёмка — с точки зрения заказчика, не набор unit-тестов.

1. **Первый запуск и Apply на проекте.** Пустой popup → **New profile** (`Profile 1`) → rows `_branch=main`, `email=a@b.c` → **Apply** на табе с `/-/` → активный таб = `{projectBase}/-/pipelines/new?_branch=main&email=a%40b.c`. Fill формы не требуется.
2. **Несколько профилей, Untitled, persist.** Второй профиль, switch, очистка имени → `Untitled` в select / `""` в storage, reopen popup сохраняет выбор и rows.
3. **Delete до пустого shell.** Delete без confirm, сосед выбран; последний Delete → снова только **New profile** + disabled **Apply**.
4. **Правка и повторный Apply.** Изменить value, Apply снова на проектном табе → URL с актуальным query; пустые ключи в URL нет.

Исключения (не-проект, duplicate key) проверяет Lead/QA; на приёмке SA — если они ломают sunny-day, фича не принимается.

## Зависимости от существующего кода

Репозиторий в корне сейчас без `src/` (parse/serialize — Task 1 в worktree). Этот срез **потребляет**, не переизобретает, контракты плана:

| Модуль | Что нужно |
|---|---|
| `src/shared/query.ts` | `Param`, `Profile`, `StorageShape`; `serializeParams`; `projectBaseFromHref`; `buildPipelineNewUrl` (Tasks 1, 3) |
| `src/shared/profiles.ts` | `nextDefaultName`, `normalizeStorage`, `createProfile`, `deleteProfile`, `tryUpdateRowKey`, `addEmptyRow`, `removeRowAt`, `updateRowValue` (Task 5) |
| `src/popup/storage.ts` | `loadStorage`, `saveStorage` (Task 7) |
| `src/popup/ui-state.ts` | `displayProfileName`, `isApplyDisabled` (Task 8) |
| `src/popup/apply-url.ts` | `APPLY_NOT_PROJECT`, `decideApplyUrl` (Task 11) |
| `src/popup/index.html`, `popup.css`, `main.ts` | DOM + CRUD + Rows + Apply handler (Tasks 6–9, 11) |
| `manifest.json` + Vite popup build | Load unpacked `dist/`; permissions `storage` + `activeTab` (Task 6) |

Не подключать в этом срезе: `isValidBulkText` / Bulk wiring (Task 10), `src/content/fill*.ts` (Tasks 12–15). Content IIFE может быть no-op, если сборка Task 6 его требует.

Popup **не** импортирует content-модули и **не** делает `chrome.runtime.sendMessage` / `chrome.scripting.executeScript`.
