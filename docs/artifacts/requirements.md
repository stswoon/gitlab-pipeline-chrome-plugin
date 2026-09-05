# Requirements: Popup named profiles and Apply

## Цель

Первый пользовательский срез расширения **GitLab Pipeline Prefill**: toolbar popup (Chrome MV3), в котором пользователь ведёт именованные профили query-параметров и по **Apply** открывает активный таб на `{projectBase}/-/pipelines/new` плюс query выбранного профиля.

Apply меняет только URL вкладки. Заполнение формы GitLab (content script) в этот срез не входит.

## In scope

- Popup shell по плану: vanilla HTML/CSS/TypeScript, ширина `400px`, разметка и id из `src/popup/index.html` плана (Task 6).
- Manifest V3, достаточный чтобы загрузить unpacked `dist/` и открыть popup: `name` / toolbar tooltip `GitLab Pipeline Prefill`, `permissions` только `["storage", "activeTab"]`, без `background`, без Options page.
- CRUD профилей в popup: создать, переключить, переименовать, удалить.
- Rows-редактор key/value для `params` выбранного профиля.
- Persist в `chrome.storage.local` ровно двух ключей: `profiles`, `selectedProfileId`.
- Apply: взять URL активного таба, если это GitLab project (`/-/` в path), навигировать на `{base}/-/pipelines/new` + сериализованный query профиля.
- Хелперы и типы из плана: `Param`, `Profile`, `StorageShape`; `nextDefaultName`, `normalizeStorage`, `createProfile`, `deleteProfile`, `tryUpdateRowKey`, `addEmptyRow`, `removeRowAt`, `updateRowValue`; `loadStorage` / `saveStorage`; `displayProfileName`, `isApplyDisabled`; `decideApplyUrl`, `APPLY_NOT_PROJECT`.
- Английские строки UI — **verbatim** из плана (см. «Ограничения»).

## Out of scope

- Content-script fill: Inputs, Variables, ветка из `_branch`, ожидание формы, `console.warn` про 15s.
- Bulk-редактор: переключение на **Bulk**, textarea, валидация `isValidBulkText`, ошибка `Invalid query string.`, запись `params` из bulk-текста.
- Клик по **Run pipeline** / **Cancel**. Не открывать **Select inputs** / **Preview inputs**.
- Новые permissions кроме `storage` + `activeTab`. Нет `tabs`. Нет `<all_urls>` сверх match-паттернов контент-скрипта.
- Новые библиотеки / UI-фреймворки: React, Vue, Tailwind, shadcn, Zustand, Plasmo, WXT.
- Options page, service worker, messaging popup → content script.
- Шифрование storage. Не утверждать в UI, что данные зашифрованы.
- Toast / overlay на странице GitLab.
- Per-profile repository URL.
- Firefox и другие браузеры.

Разметка `#btn-view-bulk` / `#bulk-view` остаётся в HTML плана, но в этом срезе **не подключается**: `#bulk-view` остаётся `hidden`, обработчика Bulk нет, `isApplyDisabled(..., bulkInvalid)` всегда вызывается с `bulkInvalid === false`.

## Ограничения

**Стек (не заменять):** Chrome Manifest V3, TypeScript `strict: true`, Vite (popup + IIFE content stub если нужен сборке), vanilla HTML/CSS/TS popup, Vitest для хелперов, npm, `package.json` version `0.1.0`. Minimum Chrome 116.

**Типы (уже заданы планом):**

```ts
type Param = { key: string; value: string };

type Profile = {
  id: string;       // crypto.randomUUID()
  name: string;
  params: Param[];  // порядок строк = порядок query
};

type StorageShape = {
  profiles: Profile[];
  selectedProfileId: string | null;
};
```

**Ключи:** ключи, начинающиеся с `_`, зарезервированы. Единственный реализованный reserved key — `_branch`. В Rows это обычная строка (нет особого виджета). Popup может хранить и другие `_…` ключи; они попадут в URL. Семантика skip-at-fill — только у будущего content script.

**Уникальность ключей:** непустые ключи в профиле уникальны (exact, case-sensitive). Несколько пустых ключей (`""`) разрешены. Дубликат не персистится; предыдущий ключ строки сохраняется.

**Сериализация (Apply):** пропуск записей с пустым ключом (trim только ключа); пустые values сохраняются; кодирование через `URLSearchParams`; результат с ведущим `?`, если есть хотя бы одна пара, иначе `""` (без `?`).

**Проектный URL (Apply):** hostname **не** обязан содержать `gitlab`. Тест — первая подстрока `/-/` в href после отрезания `#` и `?`. Нет `/-/` → не проект.

**Хранение:** first install `{ profiles: [], selectedProfileId: null }` — не сидировать профиль. Stale `selectedProfileId` чинится на первый профиль или `null` и пишется обратно. Не использовать `sessionStorage` / `localStorage` / cookies.

**Копирайт UI (verbatim English):**

| Где | Строка |
|---|---|
| Manifest `name`, `action.default_title`, `<title>` popup | `GitLab Pipeline Prefill` |
| Manifest `description` | `Prefill GitLab Run new pipeline from URL query parameters and named profiles.` |
| Display в `<select>`, если `name === ""` (в storage остаётся `""`) | `Untitled` |
| Кнопка создания | `New profile` |
| Кнопка удаления | `Delete` |
| Кнопка вида (разметка; единственный рабочий вид) | `Rows` |
| Кнопка вида (разметка; не подключена в этом срезе) | `Bulk` |
| Добавить строку | `Add row` |
| Удалить строку | `Remove` |
| Применить | `Apply` |
| Ошибка дубликата ключа | `Keys must be unique.` |
| Ошибка Apply не на проекте | `This tab is not a GitLab project. Open a project page and try Apply again.` |

Не использовать в этом срезе: `Invalid query string.`, `[GitLab Pipeline Prefill] Run new pipeline form not ready within 15s`.

Структурные подписи из HTML плана (не из списка copy, но не менять): label `Profile`, label `Name`; `aria-label` полей строки `Key` и `Value`.

**Стиль ошибок:** `#error-line` цвет `#c62828`.

## Sunny-day сценарии заказчика

1. **Первый запуск и Apply на проекте.** Пользователь открывает popup на странице GitLab-проекта (в URL есть `/-/`). Видит только **New profile** и выключенный **Apply**. Жмёт **New profile** → появляется `Profile 1`. Добавляет строки `_branch` = `main` и `email` = `a@b.c`. Жмёт **Apply**. Активный таб уходит на `{projectBase}/-/pipelines/new?_branch=main&email=a%40b.c`. Форму плагин в этом срезе не заполняет — это ожидаемо.
2. **Несколько профилей, переименование, persist.** Пользователь создаёт второй профиль (`Profile 2`), переключает select, переименовывает профиль, закрывает и снова открывает popup. Выбран последний профиль; его имя и rows на месте. Если имя очистить, в select показывается `Untitled`, в storage — `""`.
3. **Удаление до пустого состояния.** Пользователь жмёт **Delete** без диалога подтверждения. Выделение переходит на соседа. Удаление последнего профиля возвращает zero-profile shell: снова только **New profile** и disabled **Apply**.
4. **Повторный Apply после правок.** Пользователь меняет value в Rows, снова жмёт **Apply** на том же проектном табе. URL обновляется сериализованным query текущего профиля (пустые ключи в URL не попадают).

## Открытые вопросы (если остались)

Критических открытых вопросов нет. Поведение, копирайт и исключения закрыты планом (`docs/superpowers/plans/2026-09-05-gitlab-pipeline-chrome-plugin.md`, Global Constraints + Tasks 5, 7–9, 11) и spec §8.
