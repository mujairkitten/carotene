# Carotene technical documentation

## 1. System overview

Carotene is a static multi-page web app hosted on GitHub Pages.  
It contains:

- **Hub** (`/`) — entry page and tool switcher.
- **Track Record** (`/trackrecord/`) — trainee database, personal trainee list, trophy tracking, and race calendar planner.
- **Checklist** (`/checklist/`) — reset-aware daily/content/one-time task tracker.

Implementation is plain HTML/CSS + vanilla ES modules. There is no backend, no API layer, and no build step required for local source execution.

## 2. Repository structure

- `/index.html`, `/style.css`, `/hub.js` — hub UI and behavior.
- `/kao-banner.js` — shared countdown/banner component loaded in About modals.
- `/trackrecord/`
  - `index.html`, `style.css`, `main.js` — Track Record shell and wiring.
  - `core.js` — Track Record domain logic, normalization, persistence, UI helpers, toasts, accessibility announcer.
  - `standard-view.js` — trainee database + my-list rendering and interaction.
  - `calendar.js` — calendar-mode rendering, race slot interactions, drag/drop and reorder.
  - `settings.js` — settings panel, modal lifecycle, backup/import/export behavior.
  - `render-bus.js` — callback bridge to avoid circular rendering dependencies.
  - `data/database.js` — trainee aptitude source data.
  - `data/races.js` — race metadata source data.
  - `preview/` — preview build that mirrors stable files under CI checks.
- `/checklist/`
  - `index.html`, `style.css`, `main.js` — checklist app shell and behavior.
  - `core.js` — checklist domain logic and persistence.
  - `shell.js` — shared checklist chrome, settings panel behavior, modal, tooltip, toast, navigation controls.
- `/tools/check-imports.mjs` — static import/export resolver validation.
- `/tools/check-preview-sync.mjs` — stable/preview synchronization validation.

## 3. Runtime model

### 3.1 Page bootstrap

Each page bootstraps in-browser:

- Hub: immediate script (`hub.js`) reads theme and wires UI.
- Track Record: `main.js` loads state, installs render handlers, applies settings, then wires controls.
- Checklist: `main.js` initializes chrome, loads state, renders sections, wires task and backup behavior, starts reset timer.

### 3.2 State ownership

- **Hub** state is minimal (theme preferences).
- **Track Record** uses `state = { myList, settings }` in `trackrecord/core.js`.
- **Checklist** uses `state = { tasks }` in `checklist/core.js` and UI-specific state in `checklist/shell.js`.

State is kept in memory and persisted to `localStorage`.

## 4. Data and persistence

## 4.1 Storage keys

- `carotene-hub-theme` — shared theme toggles.
- `mylist` — Track Record persisted state (trainees + settings).
- `checklist` — Checklist task data.
- `checklist-ui` — Checklist UI preferences (navbar/collapsed sections).

## 4.2 Normalization and guards

Both Track Record and Checklist sanitize and normalize incoming/stored/imported data:

- Type checking and plain-object checks.
- Hard caps on payload sizes and list sizes.
- ID validation/reassignment for collisions or malformed IDs.
- Name normalization and deduplication (NFKC, trim, spacing fold, case-insensitive matching).
- Schema migration support (for settings changes and legacy shape compatibility).

If stored payloads fail to parse or violate constraints, apps degrade safely (start from normalized defaults and show error toast).

## 4.3 Backup/import

Track Record and Checklist both provide:

- JSON export (copy and/or file).
- JSON import with validation and merging.
- Deduplication and quota-aware limits.
- Non-destructive error handling (invalid import does not mutate existing state).

Track Record additionally enforces import budgets for trainees and trophies.

## 5. Track Record architecture

## 5.1 Core behavior

`trackrecord/core.js` provides:

- Constants for grade metadata, caps, and validation.
- Normalization pipeline for trainees, trophies, settings, and calendar order.
- Deferred/coalesced persistence to local storage.
- Escaping helpers for safe HTML/attribute rendering.
- Tooltip/chip wiring for aptitude explanations.
- Toasts and live announcer for feedback and accessibility.
- Domain operations: add/remove trainee, add/remove trophy, mark checked state, race lookup utilities.

## 5.2 Standard view

`trackrecord/standard-view.js` provides:

- Database grid rendering with search, sort, pagination.
- My List card rendering with progress bars and trophy checklist.
- Race suggestion combobox behavior.
- Inline per-trainee calendar tabs (Junior/Classic/Senior and OoB when enabled).
- Event-driven synchronization with custom window events (`cb-db-button`, `cb-view-trainee`, `cb-card-progress`).

## 5.3 Calendar view

`trackrecord/calendar.js` provides:

- Slot-based race mapping by year/month/turn.
- Pending/done separation and rendering.
- Race check/uncheck and add-unchecked actions.
- In-slot race reorder by drag/drop and keyboard move buttons.
- Trainee side panel for switching/adding/removing trainees.
- Race finder UI that navigates/highlights matching calendar cell.
- Calendar-local access to settings toggles, backup, and about modal triggers.

## 5.4 Settings and modal management

`trackrecord/settings.js` provides:

- Theme and navbar-position application.
- Settings panel open/close and focus-out dismissal.
- Modal open/close stack with focus trapping and inert background management.
- About and backup modal orchestration.
- Backup export cooldown handling.

## 5.5 Render bus

`trackrecord/render-bus.js` exposes late-bound render callbacks:

- `setRenderHandlers({ mainView, myList, database })`
- `renderMainView()`, `renderMyList()`, `renderDatabase()`

This decouples modules that need cross-triggered rendering and avoids circular import execution problems.

## 6. Checklist architecture

## 6.1 Core logic

`checklist/core.js` provides:

- Required mission definitions and linked-task dependencies.
- Reset schedules (`daily`: 15:00 UTC, `content`: 22:00 UTC).
- Task normalization, add/remove/restore operations.
- Done-state logic by reset window.
- Group toggles, untick-all snapshot/restore.
- Export/import merge and validation.

## 6.2 UI orchestration

`checklist/main.js` provides:

- Section rendering (Daily, Content, One-time).
- Countdown display and reset-bound rerendering.
- Per-section progress and mission aggregate state.
- Collapsible sections and persisted UI collapse state.
- Add/remove flows with undo toasts.
- Backup modal wire-up (copy/export/import).

`checklist/shell.js` provides:

- Theme and navbar settings persistence.
- Tooltips, toasts, and accessibility announcer.
- Settings panel and About modal controls.
- Carotene panel toggle behavior.
- Jump-to-top/bottom controls and scroll state sync.

## 7. Hub architecture

`hub.js` provides:

- Theme read/apply/save with fallback chain:
  1. `carotene-hub-theme`
  2. Track Record `mylist.settings`
  3. `prefers-color-scheme`
- Dynamic insertion of mode/theme buttons.
- About modal open/close, focus trap, and inert page background.
- Decorative animated background element generation.

## 8. Security and safety model

- Strict CSP meta tags on pages (self script origin, restricted object/frame/base/form policies).
- No external data writes and no server-side execution.
- HTML/attribute escaping utilities for dynamic rendering.
- Input normalization and bounds enforcement before persistence.
- Quota/serialization failure handling to avoid silent corruption.

## 9. Accessibility model

Across apps:

- Semantic controls with ARIA labels/pressed/expanded/current states.
- Keyboard support for tabs, dropdown-like suggestion lists, modal dialogs, and close-on-escape.
- Focus trapping in modals and fallback focus restoration.
- `aria-live` regions for announcements and toast feedback.
- Skip links and inert background usage for modal context isolation.

## 10. Stable vs preview flow

Track Record has two app roots:

- Stable: `/trackrecord/`
- Preview: `/trackrecord/preview/`

CI enforces source parity (except expected path/version/link differences) via `tools/check-preview-sync.mjs`.

## 11. Validation and developer tooling

- `tools/check-imports.mjs` validates import bindings against exported symbols.
- `tools/check-preview-sync.mjs` ensures preview/stable source drift is controlled.
- These checks run in CI and are suitable for local pre-commit verification.

See also: `docs/validation-scripts.md`.
