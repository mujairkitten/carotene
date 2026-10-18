# Validation scripts

## `tools/check-imports.mjs`

Verifies that every local ES module import in scanned `.js` files resolves to a real exported binding.

### Why this exists

`node --check` and minification do not catch missing named exports between modules. This script prevents browser-time module errors caused by unresolved import bindings.

### Usage

```bash
node tools/check-imports.mjs [dir ...]
```

If no directory is provided, it scans the current directory.

### What it checks

- Missing local module paths (`import ... from './missing.js'`)
- Missing named exports (`import { x }` where `x` is not exported)

### What it does not check

- Runtime scope errors (for example, using an undeclared identifier)
- Whether an export is unused

### Notes

- The scanner skips non-source directories (`node_modules`, `.git`, `icons`, `deploy`, `tools`, `.github`).
- `data/` is intentionally included because it contains ES modules used by app code.

## `tools/check-preview-sync.mjs`

Ensures `trackrecord/preview/` stays synchronized with `trackrecord/` for mirrored source files.

### Mirrored files

- `index.html`
- `style.css`
- `main.js`
- `core.js`
- `calendar.js`
- `settings.js`
- `standard-view.js`
- `render-bus.js`

### Rules

1. `trackrecord/preview/` must not contain unexpected top-level mirrored-source files.
2. Every file in the mirrored list must exist in both stable and preview builds.
3. Stable and preview content must match after normalization for expected differences:
   - Relative asset paths by directory depth
   - Build tag text
   - Version badge text
   - Stable/preview cross-link paragraph
   - The mini-landing-page HTML comment block
